"use client";

import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import type { CompanyPhoto } from "~/lib/startup-api";

export function CompanyPhotoGallery({
	companyName,
	photos,
	layout = "page",
}: {
	companyName: string;
	photos: CompanyPhoto[];
	layout?: "page" | "panel";
}) {
	const galleryPhotos = useMemo(
		() => photos.filter((photo) => photo.url.trim().length > 0),
		[photos],
	);
	const [activeIndex, setActiveIndex] = useState(0);
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const photoCount = galleryPhotos.length;
	const visiblePhotos = useMemo(
		() =>
			Array.from(
				{ length: Math.min(3, photoCount) },
				(_, offset) => galleryPhotos[(activeIndex + offset) % photoCount],
			).filter((photo): photo is CompanyPhoto => Boolean(photo)),
		[activeIndex, galleryPhotos, photoCount],
	);
	const activePhoto = galleryPhotos[activeIndex];
	const canLoop = photoCount > 1;
	const isPanel = layout === "panel";

	if (!photoCount) return null;

	function loop(direction: -1 | 1) {
		setActiveIndex(
			(current) => (current + direction + photoCount) % photoCount,
		);
	}

	function openPhoto(photo: CompanyPhoto) {
		const nextIndex = galleryPhotos.findIndex(
			(candidate) => candidate.url === photo.url,
		);
		setActiveIndex(Math.max(0, nextIndex));
		setLightboxOpen(true);
	}

	return (
		<section
			className={isPanel ? "space-y-4" : "mt-8 space-y-4"}
			id="company-photo-gallery"
		>
			<div className="flex items-center justify-between gap-3">
				<h2 className="font-semibold text-2xl">Photo gallery</h2>
				{canLoop ? (
					<div className="flex gap-2">
						<Button
							aria-label="Show previous photos"
							onClick={() => loop(-1)}
							size="icon-sm"
							type="button"
							variant="outline"
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Button
							aria-label="Show next photos"
							onClick={() => loop(1)}
							size="icon-sm"
							type="button"
							variant="outline"
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>
				) : null}
			</div>
			<div
				className={
					isPanel ? "grid gap-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
				}
			>
				{visiblePhotos.map((photo, index) => {
					const photoIndex = (activeIndex + index) % photoCount;
					return (
						<button
							aria-label={`Open ${companyName} photo ${photoIndex + 1}`}
							className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-slate-100 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-700 focus-visible:outline-offset-2"
							key={`${photo.url}-${photoIndex}`}
							onClick={() => openPhoto(photo)}
							type="button"
						>
							<Image
								alt={photo.altText || `${companyName} photo ${photoIndex + 1}`}
								className="object-cover transition duration-200 group-hover:scale-[1.02]"
								fill
								sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
								src={photo.url}
								unoptimized
							/>
							<span className="absolute right-3 bottom-3 inline-flex size-8 items-center justify-center rounded-md bg-white/90 text-slate-900 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
								<Maximize2 className="size-4" />
							</span>
						</button>
					);
				})}
			</div>
			<Dialog onOpenChange={setLightboxOpen} open={lightboxOpen}>
				<DialogContent
					className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)]"
					showCloseButton={false}
				>
					<DialogHeader className="sr-only">
						<DialogTitle>{companyName} photo gallery</DialogTitle>
						<DialogDescription>
							Full screen photo viewer for this company.
						</DialogDescription>
					</DialogHeader>
					<div className="relative h-[calc(100vh-2rem)] max-h-[52rem] min-h-80 bg-slate-950">
						<DialogClose asChild>
							<Button
								aria-label="Close photo gallery"
								className="absolute top-4 right-4 z-10 bg-white/90 text-slate-950 hover:bg-white"
								size="icon"
								type="button"
								variant="outline"
							>
								<X className="size-5" />
							</Button>
						</DialogClose>
						{activePhoto ? (
							<Image
								alt={
									activePhoto.altText ||
									`${companyName} photo ${activeIndex + 1}`
								}
								className="object-contain p-4 sm:p-8"
								fill
								sizes="100vw"
								src={activePhoto.url}
								unoptimized
							/>
						) : null}
						{canLoop ? (
							<>
								<Button
									aria-label="Show previous photo"
									className="absolute top-1/2 left-4 -translate-y-1/2 bg-white/90 text-slate-950 hover:bg-white"
									onClick={() => loop(-1)}
									size="icon"
									type="button"
									variant="outline"
								>
									<ChevronLeft className="size-5" />
								</Button>
								<Button
									aria-label="Show next photo"
									className="absolute top-1/2 right-4 -translate-y-1/2 bg-white/90 text-slate-950 hover:bg-white"
									onClick={() => loop(1)}
									size="icon"
									type="button"
									variant="outline"
								>
									<ChevronRight className="size-5" />
								</Button>
							</>
						) : null}
						<div className="absolute right-4 bottom-4 rounded-md bg-white/90 px-2 py-1 font-medium text-slate-950 text-xs">
							{activeIndex + 1} / {photoCount}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</section>
	);
}
