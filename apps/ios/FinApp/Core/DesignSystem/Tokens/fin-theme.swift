import SwiftUI

enum FinTheme {
    enum Spacing {
        static let xSmall: CGFloat = 4
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let xLarge: CGFloat = 24
        static let xxLarge: CGFloat = 32
        static let xxxLarge: CGFloat = 40
    }

    enum Radius {
        static let small: CGFloat = 10
        static let medium: CGFloat = 14
        static let large: CGFloat = 18
        static let xLarge: CGFloat = 22
        static let pill: CGFloat = 999
    }

    enum ColorToken {
        // Brand
        static let accent = Color(red: 0.18, green: 0.45, blue: 0.92)
        static let accentStrong = Color(red: 0.10, green: 0.32, blue: 0.82)
        static let accentSoft = Color(red: 0.88, green: 0.92, blue: 1.00)

        // Semantic
        static let positive = Color(red: 0.08, green: 0.62, blue: 0.36)
        static let warning = Color(red: 0.95, green: 0.58, blue: 0.16)
        static let destructive = Color(red: 0.88, green: 0.18, blue: 0.22)

        // Text
        static let textPrimary = Color.primary
        static let textSecondary = Color.secondary
        static let textTertiary = Color.secondary.opacity(0.72)

        // shadcn-like surfaces
        static let appBackground = Color(red: 0.975, green: 0.976, blue: 0.980) // gray-50-ish
        static let surface = Color.white
        static let elevatedSurface = Color.white
        static let mutedSurface = Color(red: 0.955, green: 0.960, blue: 0.968)

        // shadcn-like border
        static let border = Color.black.opacity(0.11) // gray-200-ish
        static let softBorder = Color.black.opacity(0.07)

        // Charts
        static let chartPrimary = accent
        static let chartSecondary = Color(red: 0.42, green: 0.62, blue: 0.96)
        static let chartMuted = Color.gray.opacity(0.22)
    }

    enum Shadow {
        static let card = Color.black.opacity(0.06)
        static let soft = Color.black.opacity(0.04)
        static let glass = Color.black.opacity(0.10)
    }
}

struct FinCardBackground: ViewModifier {
    let cornerRadius: CGFloat
    let shadow: Bool

    func body(content: Content) -> some View {
        content
            .background(FinTheme.ColorToken.surface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(FinTheme.ColorToken.border, lineWidth: 1)
            }
            .shadow(
                color: shadow ? FinTheme.Shadow.card : .clear,
                radius: shadow ? 10 : 0,
                x: 0,
                y: shadow ? 4 : 0
            )
    }
}

struct FinGlassBackground: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.35), lineWidth: 1)
            }
            .shadow(color: FinTheme.Shadow.glass, radius: 20, x: 0, y: 10)
    }
}

extension View {
    func finCard(
        cornerRadius: CGFloat = FinTheme.Radius.xLarge,
        shadow: Bool = true
    ) -> some View {
        modifier(FinCardBackground(cornerRadius: cornerRadius, shadow: shadow))
    }

    func finGlass(cornerRadius: CGFloat = FinTheme.Radius.large) -> some View {
        modifier(FinGlassBackground(cornerRadius: cornerRadius))
    }
}
