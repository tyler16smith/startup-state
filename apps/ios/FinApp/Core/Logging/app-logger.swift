import Foundation
import OSLog

enum AppLogger {
    private static let logger = Logger(subsystem: Environment.bundleIdentifier, category: "FinApp")

    static func info(_ message: String, metadata: [String: CustomStringConvertible] = [:]) {
        log(level: .info, message: message, metadata: metadata)
    }

    static func warn(_ message: String, metadata: [String: CustomStringConvertible] = [:]) {
        log(level: .warning, message: message, metadata: metadata)
    }

    static func error(_ message: String, metadata: [String: CustomStringConvertible] = [:]) {
        log(level: .error, message: message, metadata: metadata)
    }

    private static func log(
        level: LogLevel,
        message: String,
        metadata: [String: CustomStringConvertible]
    ) {
        let details = sanitizedDetails(from: metadata)

        switch level {
        case .info:
            logger.info("\(message, privacy: .public) \(details, privacy: .public)")
        case .warning:
            logger.warning("\(message, privacy: .public) \(details, privacy: .public)")
        case .error:
            logger.error("\(message, privacy: .public) \(details, privacy: .public)")
        }
    }

    private static func sanitizedDetails(from metadata: [String: CustomStringConvertible]) -> String {
        guard !metadata.isEmpty else { return "" }

        let pairs = metadata
            .sorted { $0.key < $1.key }
            .map { key, value in
                "\(key)=\(isSensitive(key) ? "[redacted]" : String(describing: value))"
            }

        return pairs.joined(separator: " ")
    }

    private static func isSensitive(_ key: String) -> Bool {
        let lowercased = key.lowercased()
        return lowercased.contains("token")
            || lowercased.contains("password")
            || lowercased.contains("secret")
            || lowercased.contains("email")
            || lowercased.contains("account")
            || lowercased.contains("routing")
    }

    private enum LogLevel {
        case info
        case warning
        case error
    }
}