import Foundation
import Security

/// Securely stores authentication credentials in the Keychain
final class CredentialsStore {
    
    static let shared = CredentialsStore()
    
    private let service = "com.app.mobile"
    private let sessionKey = "user_session"
    
    private init() {}
    
    // MARK: - Session Storage
    
    /// Saves the current session to the Keychain
    func saveSession(_ session: Session) throws {
        let data = try JSONEncoder().encode(session)
        try save(data: data, forKey: sessionKey)
    }
    
    /// Retrieves the stored session from the Keychain
    func loadSession() -> Session? {
        guard let data = load(forKey: sessionKey) else { return nil }
        return try? JSONDecoder().decode(Session.self, from: data)
    }
    
    /// Removes the stored session from the Keychain
    func clearSession() {
        delete(forKey: sessionKey)
    }
    
    // MARK: - Private Keychain Operations
    
    private func save(data: Data, forKey key: String) throws {
        // Delete existing item first
        delete(forKey: key)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw CredentialsStoreError.saveFailed(status)
        }
    }
    
    private func load(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }
    
    private func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Errors

enum CredentialsStoreError: LocalizedError {
    case saveFailed(OSStatus)
    
    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Failed to save credentials: \(status)"
        }
    }
}
