import SwiftUI
import AuthenticationServices

private struct AuthInputFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color(.separator), lineWidth: 1)
            )
    }
}

private extension View {
    func authInputFieldStyle() -> some View {
        modifier(AuthInputFieldModifier())
    }
}

/// Login screen for email/password authentication
struct LoginView: View {
    
    @StateObject private var viewModel = AuthViewModel()
    @FocusState private var focusedField: Field?
    
    private enum Field {
        case name
        case email
        case password
        case confirmPassword
        case referralCode
        case twoFactorToken
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo / Header
                    VStack(spacing: 12) {
                        FinLogoShape(color: .primary, size: 80)
                        
                        Text("App")
                            .font(.title)
                            .fontWeight(.bold)
                        
                        Text(viewModel.mode == .signIn ? "Sign in to access your finances" : "Create your account from iPhone")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)
                    
                    VStack(spacing: 16) {
                        if viewModel.step == .credentials {
                            credentialsFields
                        } else {
                            twoFactorFields
                        }
                        
                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        
                        Button {
                            Task { await viewModel.submitPrimaryAction() }
                        } label: {
                            Group {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text(viewModel.primaryButtonTitle)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!viewModel.isValid || viewModel.isLoading)

                        if viewModel.step == .twoFactor {
                            Button("Use a different sign-in method") {
                                viewModel.cancelTwoFactor()
                            }
                            .disabled(viewModel.isLoading)
                        }
                        
                        if viewModel.step == .credentials {
                            HStack {
                                Rectangle()
                                    .fill(Color(.separator))
                                    .frame(height: 1)

                                Text("or")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                Rectangle()
                                    .fill(Color(.separator))
                                    .frame(height: 1)
                            }
                            .padding(.vertical, 8)

                            Button {
                                Task { await viewModel.signInWithGoogle() }
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "g.circle.fill")
                                        .font(.title3)
                                    Text("Continue with Google")
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                            }
                            .buttonStyle(.bordered)
                            .disabled(viewModel.isLoading)

                            SignInWithAppleButton(.continue) { request in
                                request.requestedScopes = [.fullName, .email]
                            } onCompletion: { result in
                                Task { await viewModel.signInWithApple(result) }
                            }
                            .signInWithAppleButtonStyle(.black)
                            .frame(height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .disabled(viewModel.isLoading)

                            Button {
                                Task { await viewModel.startDemoMode() }
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "play.circle.fill")
                                        .font(.title3)
                                    Text("Try demo mode")
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                            }
                            .buttonStyle(.bordered)
                            .disabled(viewModel.isLoading)

                            Button(viewModel.mode == .signIn ? "Create an account" : "I already have an account") {
                                viewModel.switchMode()
                            }
                            .disabled(viewModel.isLoading)
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer(minLength: 40)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.email) { _ in
                viewModel.clearError()
            }
            .onChange(of: viewModel.password) { _ in
                viewModel.clearError()
            }
            .onChange(of: viewModel.confirmPassword) { _ in
                viewModel.clearError()
            }
            .onChange(of: viewModel.twoFactorToken) { _ in
                viewModel.clearError()
            }
        }
    }

    private var credentialsFields: some View {
        VStack(spacing: 16) {
            if viewModel.mode == .register {
                formField(title: "Name") {
                    TextField("Your name", text: $viewModel.name)
                        .textFieldStyle(.plain)
                        .authInputFieldStyle()
                        .textContentType(.name)
                        .focused($focusedField, equals: .name)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .email }
                }
            }

            formField(title: "Email") {
                TextField(
                    "",
                    text: $viewModel.email,
                    prompt: Text("you@example.com").foregroundColor(.secondary)
                )
                    .textFieldStyle(.plain)
                    .authInputFieldStyle()
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }
            }

            formField(title: "Password") {
                SecureField("Enter your password", text: $viewModel.password)
                    .textFieldStyle(.plain)
                    .authInputFieldStyle()
                    .textContentType(viewModel.mode == .signIn ? .password : .newPassword)
                    .focused($focusedField, equals: .password)
                    .submitLabel(viewModel.mode == .signIn ? .go : .next)
                    .onSubmit {
                        if viewModel.mode == .signIn {
                            Task { await viewModel.signIn() }
                        } else {
                            focusedField = .confirmPassword
                        }
                    }
            }

            if viewModel.mode == .register {
                formField(title: "Confirm password") {
                    SecureField("Re-enter your password", text: $viewModel.confirmPassword)
                        .textFieldStyle(.plain)
                        .authInputFieldStyle()
                        .textContentType(.newPassword)
                        .focused($focusedField, equals: .confirmPassword)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .referralCode }
                }

                formField(title: "Referral code") {
                    TextField("Optional", text: $viewModel.referralCode)
                        .textFieldStyle(.plain)
                        .authInputFieldStyle()
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .referralCode)
                        .submitLabel(.go)
                        .onSubmit { Task { await viewModel.register() } }
                }
            }
        }
    }

    private var twoFactorFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Two-factor verification")
                    .font(.headline)
                Text("Enter the current code from your authenticator app.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            TextField("123456", text: $viewModel.twoFactorToken)
                .textFieldStyle(.plain)
                .authInputFieldStyle()
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .focused($focusedField, equals: .twoFactorToken)
                .onSubmit { Task { await viewModel.verifyTwoFactor() } }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func formField<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
            content()
        }
    }
}

// MARK: - Preview

#Preview {
    LoginView()
}
