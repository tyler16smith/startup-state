import SwiftUI

@main
struct FinAppApp: App {
    @StateObject private var deepLinkRouter = DeepLinkRouter()
    
    init() {
        // Bootstrap auth state on app launch
        Task {
            await AuthManager.shared.bootstrap()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            AppRouter()
                .environmentObject(deepLinkRouter)
                .onOpenURL { url in
                    deepLinkRouter.handle(url)
                }
        }
    }
}
