/**
 * Fin Marketing Site - Scripts
 * Vanilla JavaScript for animations and interactions
 */

(function () {
	"use strict";

	// ==========================================================================
	// Utility Functions
	// ==========================================================================

	/**
	 * Debounce function to limit execution rate
	 */
	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	/**
	 * Check if user prefers reduced motion
	 */
	function prefersReducedMotion() {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	// ==========================================================================
	// Navigation
	// ==========================================================================

	const navHeader = document.getElementById("nav-header");
	const mobileMenuBtn = document.getElementById("mobile-menu-btn");
	const mobileMenu = document.getElementById("mobile-menu");

	/**
	 * Update navigation style on scroll
	 */
	function updateNavOnScroll() {
		if (window.scrollY > 50) {
			navHeader.classList.add("scrolled");
		} else {
			navHeader.classList.remove("scrolled");
		}
	}

	/**
	 * Toggle mobile menu
	 */
	function toggleMobileMenu() {
		const isActive = mobileMenu.classList.contains("active");

		mobileMenu.classList.toggle("active");
		mobileMenuBtn.classList.toggle("active");

		// Update aria-expanded
		mobileMenuBtn.setAttribute("aria-expanded", !isActive);

		// Prevent body scroll when menu is open
		document.body.style.overflow = !isActive ? "hidden" : "";
	}

	/**
	 * Close mobile menu when clicking a link
	 */
	function closeMobileMenu() {
		mobileMenu.classList.remove("active");
		mobileMenuBtn.classList.remove("active");
		mobileMenuBtn.setAttribute("aria-expanded", "false");
		document.body.style.overflow = "";
	}

	// Event listeners for navigation
	window.addEventListener("scroll", debounce(updateNavOnScroll, 10));

	if (mobileMenuBtn) {
		mobileMenuBtn.addEventListener("click", toggleMobileMenu);
	}

	// Close mobile menu when clicking links
	const mobileLinks = document.querySelectorAll(".mobile-link, .mobile-cta");
	mobileLinks.forEach((link) => {
		link.addEventListener("click", closeMobileMenu);
	});

	// ==========================================================================
	// Smooth Scrolling for Anchor Links
	// ==========================================================================

	/**
	 * Smooth scroll to target element
	 */
	function smoothScrollTo(targetId) {
		const target = document.querySelector(targetId);
		if (!target) return;

		const navHeight = navHeader ? navHeader.offsetHeight : 0;
		const targetPosition =
			target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;

		window.scrollTo({
			top: targetPosition,
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
	}

	// Handle all anchor links
	document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
		anchor.addEventListener("click", function (e) {
			const href = this.getAttribute("href");
			if (href === "#") return;

			e.preventDefault();
			smoothScrollTo(href);

			// Update URL without jumping
			history.pushState(null, null, href);
		});
	});

	// ==========================================================================
	// Reveal on Scroll Animation
	// ==========================================================================

	/**
	 * Initialize reveal animations with IntersectionObserver
	 */
	function initRevealAnimations() {
		// Skip if user prefers reduced motion
		if (prefersReducedMotion()) {
			document.querySelectorAll(".reveal").forEach((el) => {
				el.classList.add("visible");
			});
			return;
		}

		const revealElements = document.querySelectorAll(".reveal");

		if (!revealElements.length) return;

		const observerOptions = {
			root: null,
			rootMargin: "0px 0px -80px 0px",
			threshold: 0.1,
		};

		const revealObserver = new IntersectionObserver((entries, observer) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("visible");
					observer.unobserve(entry.target);
				}
			});
		}, observerOptions);

		revealElements.forEach((el) => {
			revealObserver.observe(el);
		});
	}

	// ==========================================================================
	// FAQ Accordion
	// ==========================================================================

	/**
	 * Initialize FAQ accordion functionality
	 */
	function initFaqAccordion() {
		const faqItems = document.querySelectorAll(".faq-item");

		if (!faqItems.length) return;

		faqItems.forEach((item) => {
			const question = item.querySelector(".faq-question");
			const answer = item.querySelector(".faq-answer");

			if (!question || !answer) return;

			question.addEventListener("click", () => {
				const isActive = item.classList.contains("active");
				const isExpanded = question.getAttribute("aria-expanded") === "true";

				// Close all other items
				faqItems.forEach((otherItem) => {
					if (otherItem !== item) {
						otherItem.classList.remove("active");
						const otherQuestion = otherItem.querySelector(".faq-question");
						if (otherQuestion) {
							otherQuestion.setAttribute("aria-expanded", "false");
						}
					}
				});

				// Toggle current item
				item.classList.toggle("active");
				question.setAttribute("aria-expanded", !isExpanded);
			});

			// Keyboard accessibility
			question.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					question.click();
				}
			});
		});
	}

	// ==========================================================================
	// Product Preview Floating Animation
	// ==========================================================================

	/**
	 * Add subtle floating animation to product preview
	 */
	function initProductPreviewAnimation() {
		if (prefersReducedMotion()) return;

		const preview = document.querySelector(".product-preview");
		if (!preview) return;

		let start = null;
		const amplitude = 8;
		const period = 4000;

		function animate(timestamp) {
			if (!start) start = timestamp;
			const progress = timestamp - start;
			const offset = Math.sin((progress / period) * 2 * Math.PI) * amplitude;

			preview.style.transform = `translateY(${offset}px)`;
			requestAnimationFrame(animate);
		}

		// Start animation when preview is visible
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					requestAnimationFrame(animate);
					observer.unobserve(entry.target);
				}
			});
		});

		observer.observe(preview);
	}

	// ==========================================================================
	// Chart Animation
	// ==========================================================================

	/**
	 * Animate chart drawing
	 */
	function initChartAnimation() {
		if (prefersReducedMotion()) return;

		const chartLines = document.querySelectorAll(".chart-line");

		chartLines.forEach((line) => {
			const length = line.getTotalLength ? line.getTotalLength() : 1000;

			line.style.strokeDasharray = length;
			line.style.strokeDashoffset = length;

			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							line.style.transition = "stroke-dashoffset 1.5s ease-in-out";
							line.style.strokeDashoffset = "0";
							observer.unobserve(entry.target);
						}
					});
				},
				{ threshold: 0.5 },
			);

			observer.observe(line);
		});
	}

	// ==========================================================================
	// Stat Counter Animation
	// ==========================================================================

	/**
	 * Animate stat values counting up
	 */
	function initStatCounters() {
		if (prefersReducedMotion()) return;

		const statValues = document.querySelectorAll(
			".stat-value, .portfolio-amount, .app-preview-card-header strong",
		);

		statValues.forEach((stat) => {
			const originalText = stat.textContent;
			const isMonetary = originalText.includes("$");
			const hasCommas = originalText.includes(",");

			// Extract number from text
			const numberMatch = originalText.match(/[\d,]+/);
			if (!numberMatch) return;

			const targetNumber = parseInt(numberMatch[0].replace(/,/g, ""), 10);
			const prefix = originalText.substring(
				0,
				originalText.indexOf(numberMatch[0]),
			);
			const suffix = originalText.substring(
				originalText.indexOf(numberMatch[0]) + numberMatch[0].length,
			);

			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							animateValue(
								stat,
								0,
								targetNumber,
								1500,
								prefix,
								suffix,
								hasCommas,
							);
							observer.unobserve(entry.target);
						}
					});
				},
				{ threshold: 0.5 },
			);

			observer.observe(stat);
		});
	}

	/**
	 * Animate a value from start to end
	 */
	function animateValue(
		element,
		start,
		end,
		duration,
		prefix,
		suffix,
		useCommas,
	) {
		const startTime = performance.now();

		function update(currentTime) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function (ease-out)
			const easeOut = 1 - Math.pow(1 - progress, 3);
			const current = Math.round(start + (end - start) * easeOut);

			let displayValue = current.toString();
			if (useCommas) {
				displayValue = current.toLocaleString();
			}

			element.textContent = prefix + displayValue + suffix;

			if (progress < 1) {
				requestAnimationFrame(update);
			}
		}

		requestAnimationFrame(update);
	}

	// ==========================================================================
	// Initialize All
	// ==========================================================================

	function init() {
		// Update nav state on load
		updateNavOnScroll();

		// Initialize all features
		initRevealAnimations();
		initFaqAccordion();
		initProductPreviewAnimation();
		initChartAnimation();
		initStatCounters();
	}

	// Run when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
