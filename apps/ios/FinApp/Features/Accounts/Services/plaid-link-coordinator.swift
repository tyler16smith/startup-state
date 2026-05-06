import Foundation
import LinkKit
import UIKit

@MainActor
final class PlaidLinkCoordinator {
    private static var activeHandler: Handler?

    private var handler: Handler?
    private var continuation: CheckedContinuation<PlaidLinkCompletion, Error>?

    static func continueFromRedirect(_ url: URL) -> Bool {
        guard let activeHandler else { return false }
        activeHandler.resumeAfterTermination(from: url)
        return true
    }

    func open(linkToken: String) async throws -> PlaidLinkCompletion {
        guard continuation == nil else {
            throw PlaidLinkError.alreadyPresenting
        }

        guard let presenter = UIApplication.shared.finTopViewController else {
            throw PlaidLinkError.noPresenter
        }

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                self.createAndOpenHandler(linkToken: linkToken, presenter: presenter)
            }
        } onCancel: {
            Task { @MainActor in
                self.finish(.failure(PlaidLinkError.cancelled))
            }
        }
    }

    private func createAndOpenHandler(linkToken: String, presenter: UIViewController) {
        var configuration = LinkTokenConfiguration(token: linkToken) { [weak self] success in
            Task { @MainActor in
                self?.finish(
                    .success(
                        PlaidLinkCompletion(
                            publicToken: success.publicToken,
                            metadata: Self.metadata(from: success.metadata.metadataJSON)
                        )
                    )
                )
            }
        }

        configuration.onExit = { [weak self] exit in
            Task { @MainActor in
                if let error = exit.error {
                    self?.finish(.failure(PlaidLinkError.linkExited(error.localizedDescription)))
                } else {
                    self?.finish(.failure(PlaidLinkError.cancelled))
                }
            }
        }

        configuration.onEvent = { event in
            AppLogger.info("Plaid Link event", metadata: ["event": String(describing: event.eventName)])
        }
        configuration.noLoadingState = false
        configuration.showGradientBackground = true

        let result = Plaid.create(configuration, onLoad: {
            AppLogger.info("Plaid Link loaded")
        })

        switch result {
        case .failure(let error):
            finish(.failure(PlaidLinkError.createFailed(String(describing: error))))
        case .success(let handler):
            self.handler = handler
            Self.activeHandler = handler
            handler.open(presentUsing: .viewController(presenter))
        }
    }

    private func finish(_ result: Result<PlaidLinkCompletion, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        Self.activeHandler = nil
        handler = nil

        switch result {
        case .success(let completion):
            continuation.resume(returning: completion)
        case .failure(let error):
            continuation.resume(throwing: error)
        }
    }

    private static func metadata(from rawMetadata: String?) -> PlaidLinkMetadata? {
        guard
            let rawMetadata,
            let data = rawMetadata.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let institution = object["institution"] as? [String: Any]
        else {
            return nil
        }

        let name = institution["name"] as? String
        let institutionId = institution["institution_id"] as? String
        guard name != nil || institutionId != nil else { return nil }

        return PlaidLinkMetadata(institutionName: name, institutionId: institutionId)
    }
}

enum PlaidLinkError: LocalizedError, Equatable {
    case alreadyPresenting
    case noPresenter
    case createFailed(String)
    case linkExited(String)
    case cancelled

    var errorDescription: String? {
        switch self {
        case .alreadyPresenting:
            return "A bank connection is already in progress."
        case .noPresenter:
            return "Unable to open the bank connection sheet."
        case .createFailed(let message):
            return "Unable to start bank connection. \(message)"
        case .linkExited(let message):
            return "Bank connection closed. \(message)"
        case .cancelled:
            return "Bank connection canceled."
        }
    }
}

private extension UIApplication {
    var finTopViewController: UIViewController? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController?
            .finTopPresentedViewController
    }
}

private extension UIViewController {
    var finTopPresentedViewController: UIViewController {
        if let presentedViewController {
            return presentedViewController.finTopPresentedViewController
        }

        if let navigationController = self as? UINavigationController, let visibleViewController = navigationController.visibleViewController {
            return visibleViewController.finTopPresentedViewController
        }

        if let tabBarController = self as? UITabBarController, let selectedViewController = tabBarController.selectedViewController {
            return selectedViewController.finTopPresentedViewController
        }

        return self
    }
}
