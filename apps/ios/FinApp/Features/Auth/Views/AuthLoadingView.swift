import SwiftUI

/// The "F" logo made of six squares, matching apps/web/public/fin-logo.svg
struct FinLogoShape: View {
    var color: Color = .primary
    var size: CGFloat = 120

    // SVG viewBox is 180×180; scale factor maps to desired size
    var body: some View {
        let scale = size / 180
        let blockSize = 40 * scale
        let gap = 10 * scale   // 70 - (20 + 40) = 10
        let corner = 5 * scale
        let originX = 20 * scale
        let originY = 15 * scale

        Canvas { ctx, _ in
            let positions: [(CGFloat, CGFloat)] = [
                // Top row (3 blocks)
                (originX, originY),
                (originX + blockSize + gap, originY),
                (originX + (blockSize + gap) * 2, originY),
                // Middle row (2 blocks)
                (originX, originY + blockSize + gap),
                (originX + blockSize + gap, originY + blockSize + gap),
                // Bottom row (1 block — vertical stem)
                (originX, originY + (blockSize + gap) * 2),
            ]
            for (x, y) in positions {
                let rect = CGRect(x: x, y: y, width: blockSize, height: blockSize)
                let path = Path(roundedRect: rect, cornerRadius: corner)
                // White fill
                ctx.fill(path, with: .color(.white))
                // Colored border
                ctx.stroke(path, with: .color(color), lineWidth: 2 * scale)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Loading screen shown during auth bootstrap
struct AuthLoadingView: View {
    var body: some View {
        VStack(spacing: 32) {
            FinLogoShape(color: .primary, size: 120)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview

#Preview {
    AuthLoadingView()
}
