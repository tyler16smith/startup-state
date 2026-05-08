(function () {
	"use strict";

	const mobileMenuBtn = document.getElementById("mobile-menu-btn");
	const mobileMenu = document.getElementById("mobile-menu");

	function closeMobileMenu() {
		if (!mobileMenu || !mobileMenuBtn) return;
		mobileMenu.classList.remove("active");
		mobileMenuBtn.setAttribute("aria-expanded", "false");
		document.body.style.overflow = "";
	}

	if (mobileMenuBtn && mobileMenu) {
		mobileMenuBtn.addEventListener("click", () => {
			const active = mobileMenu.classList.toggle("active");
			mobileMenuBtn.setAttribute("aria-expanded", String(active));
			document.body.style.overflow = active ? "hidden" : "";
		});
	}

	document.querySelectorAll(".mobile-link, .mobile-cta").forEach((link) => {
		link.addEventListener("click", closeMobileMenu);
	});

	if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) entry.target.classList.add("visible");
				}
			},
			{ threshold: 0.12 },
		);
		document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
	} else {
		document.querySelectorAll(".reveal").forEach((element) => {
			element.classList.add("visible");
		});
	}
})();