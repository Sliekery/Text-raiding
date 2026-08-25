import PhotosUI
import SwiftUI
import UIKit

/// The cutting board: pick a cutter, drag the photo under it, stamp it out.
struct CutterEditorView: View {
    @EnvironmentObject private var store: StickerStore

    @State private var shape = CutterShapeLibrary.default
    @State private var category: CutterShape.Category = .basics
    @State private var photo: UIImage?
    @State private var transform = PhotoTransform()
    @State private var style = StickerStyle()

    @State private var pickerItem: PhotosPickerItem?
    @State private var isLoadingPhoto = false
    @State private var showingCamera = false
    @State private var showingStyle = false
    @State private var cut: CutResult?
    @State private var errorMessage: String?

    // Each gesture remembers where it started, so pinching, dragging and
    // rotating at the same time don't fight over the transform.
    @State private var dragStart: CGSize?
    @State private var zoomStart: CGFloat?
    @State private var rotationStart: CGFloat?

    private struct CutResult: Identifiable {
        let id = UUID()
        let image: UIImage
        let shapeName: String
        /// The PNG on disk — sharing the file keeps the transparency that
        /// sharing a `UIImage` would flatten.
        let url: URL
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                board
                controls
            }
            .navigationTitle("Cookie Cutter")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
            .sheet(isPresented: $showingCamera) {
                CameraPicker(isPresented: $showingCamera) { image in
                    photo = image
                    transform = .identity
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showingStyle) {
                StyleSheet(style: $style, shape: shape)
                    .presentationDetents([.medium])
            }
            .sheet(item: $cut) { result in
                StickerResultView(image: result.image, shapeName: result.shapeName,
                                  url: result.url)
            }
            .alert("Something went wrong", isPresented: errorBinding) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                load(item)
            }
        }
    }

    // MARK: Board

    private var board: some View {
        GeometryReader { geometry in
            let side = max(min(geometry.size.width - 32, geometry.size.height - 24), 1)
            let boardShape = RoundedRectangle(cornerRadius: 22, style: .continuous)
            ZStack {
                boardShape.fill(Color(.secondarySystemBackground))
                    .frame(width: side, height: side)

                if let photo {
                    // A ghost of the whole photo, so you can see what you are aiming at.
                    // Clipped to the board, otherwise it spills over the controls.
                    photoLayer(photo, side: side)
                        .opacity(0.16)
                        .clipShape(boardShape)
                    photoLayer(photo, side: side)
                        .mask {
                            CutterShapeView(shape: shape)
                                .fill(Color.black)
                                .frame(width: side, height: side)
                        }
                } else {
                    CutterShapeView(shape: shape)
                        .fill(
                            LinearGradient(colors: [Color.accentColor.opacity(0.45),
                                                    Color.accentColor.opacity(0.18)],
                                           startPoint: .topLeading,
                                           endPoint: .bottomTrailing)
                        )
                        .frame(width: side, height: side)
                }

                CutterShapeView(shape: shape)
                    .stroke(Color.white, lineWidth: 2)
                    .shadow(color: .black.opacity(0.35), radius: 2)
                    .frame(width: side, height: side)
                    .allowsHitTesting(false)

                if photo == nil {
                    emptyHint
                }
                if isLoadingPhoto {
                    ProgressView().controlSize(.large)
                }
            }
            .frame(width: side, height: side)
            .contentShape(Rectangle())
            .gesture(boardGesture(side: side))
            .onTapGesture(count: 2) {
                withAnimation(.snappy) { transform = .identity }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func photoLayer(_ image: UIImage, side: CGFloat) -> some View {
        Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: side, height: side)          // aspect-fill baseline
            .scaleEffect(transform.zoom)
            .rotationEffect(.radians(transform.rotation))
            .offset(x: transform.offset.width * side, y: transform.offset.height * side)
            .frame(width: side, height: side)          // back to a square slot
    }

    private var emptyHint: some View {
        VStack(spacing: 6) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 28))
            Text("Add a photo to cut")
                .font(.subheadline.weight(.medium))
        }
        .foregroundStyle(.white.opacity(0.9))
        .shadow(radius: 3)
        .allowsHitTesting(false)
    }

    // MARK: Gestures

    private func boardGesture(side: CGFloat) -> some Gesture {
        let drag = DragGesture()
            .onChanged { value in
                let start = dragStart ?? transform.offset
                dragStart = start
                transform.offset = CGSize(
                    width: start.width + value.translation.width / side,
                    height: start.height + value.translation.height / side
                )
                transform = transform.clamped
            }
            .onEnded { _ in dragStart = nil }

        let magnify = MagnifyGesture()
            .onChanged { value in
                let start = zoomStart ?? transform.zoom
                zoomStart = start
                transform.zoom = start * value.magnification
                transform = transform.clamped
            }
            .onEnded { _ in zoomStart = nil }

        let rotate = RotateGesture()
            .onChanged { value in
                let start = rotationStart ?? transform.rotation
                rotationStart = start
                transform.rotation = start + value.rotation.radians
            }
            .onEnded { _ in rotationStart = nil }

        return drag.simultaneously(with: magnify).simultaneously(with: rotate)
    }

    // MARK: Controls

    private var controls: some View {
        VStack(spacing: 12) {
            Picker("Category", selection: $category) {
                ForEach(CutterShape.Category.allCases) { category in
                    Text(category.rawValue).tag(category)
                }
            }
            .pickerStyle(.segmented)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(CutterShapeLibrary.shapes(in: category)) { candidate in
                        Button {
                            withAnimation(.snappy) { shape = candidate }
                        } label: {
                            ShapeThumbnail(shape: candidate, isSelected: candidate == shape)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 2)
            }

            HStack(spacing: 10) {
                PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label("Photo", systemImage: "photo")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                if CameraPicker.isAvailable {
                    Button {
                        showingCamera = true
                    } label: {
                        Label("Camera", systemImage: "camera")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                Button {
                    showingStyle = true
                } label: {
                    Label("Style", systemImage: "slider.horizontal.3")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .labelStyle(.titleAndIcon)

            Button(action: cutItOut) {
                Label("Cut it out", systemImage: "scissors")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .disabled(photo == nil)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(.bar)
    }

    // MARK: Actions

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func load(_ item: PhotosPickerItem) {
        isLoadingPhoto = true
        Task {
            defer { isLoadingPhoto = false }
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    errorMessage = "That photo could not be opened."
                    return
                }
                photo = image
                transform = .identity
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func cutItOut() {
        guard let photo else { return }
        let image = StickerRenderer.render(image: photo, shape: shape,
                                           transform: transform, style: style)
        do {
            let sticker = try store.add(image: image, shapeID: shape.id, shapeName: shape.name)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            cut = CutResult(image: image, shapeName: shape.name, url: sticker.url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    CutterEditorView().environmentObject(StickerStore.shared)
}
