let revealObserver = null;

// Initialize site interactions once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const commentForm = document.getElementById('commentForm');
    const commentAlert = document.getElementById('commentAlert');

    if (commentForm && commentAlert) {
        // Simulate submission feedback and celebrate with paw confetti
        commentForm.addEventListener('submit', (event) => {
            event.preventDefault();
            commentAlert.classList.remove('d-none');
            commentForm.reset();
            releasePawConfetti(commentAlert);
        });
    }

    const animatedElements = document.querySelectorAll('[data-animate]');
    if (animatedElements.length) {
        const observer = getRevealObserver();
        animatedElements.forEach((element) => observer.observe(element));
    }

    const catCarouselTrack = document.querySelector('.cat-type-track');
    if (catCarouselTrack) {
        loadCatTypes(catCarouselTrack)
            .then((hasCards) => {
                if (hasCards) {
                    setupCatCarousel(catCarouselTrack);
                }
            })
            .catch((error) => {
                console.error('Failed to load cat personalities.', error);
            });
    }
});

function getRevealObserver() {
    if (revealObserver) {
        return revealObserver;
    }

    revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2,
        rootMargin: '0px 0px -40px 0px'
    });

    return revealObserver;
}

// Spawn a quick paw emoji animation near the provided container
function releasePawConfetti(container) {
    const paw = document.createElement('span');
    paw.textContent = '🐾';
    paw.style.position = 'absolute';
    paw.style.fontSize = '1.75rem';
    paw.style.animation = 'pawPop 1.2s ease-out forwards';
    paw.style.pointerEvents = 'none';
    paw.style.transform = 'translate(-50%, 0)';
    const rect = container.getBoundingClientRect();
    paw.style.left = `${rect.left + rect.width / 2}px`;
    paw.style.top = `${rect.top}px`;
    document.body.appendChild(paw);
    setTimeout(() => paw.remove(), 1200);
}

async function loadCatTypes(track) {
    const statusEl = document.getElementById('catTypeStatus');

    try {
        const response = await fetch('data/cat-types.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch cat types: ${response.status}`);
        }

        const cats = await response.json();
        track.innerHTML = '';
        const observer = getRevealObserver();

        cats.forEach((cat) => {
            const card = createCatTypeCard(cat);
            track.appendChild(card);
            if (observer) {
                observer.observe(card);
            }
        });

        track.dataset.cardCount = String(cats.length);

        if (statusEl) {
            statusEl.textContent = 'Enjoy the slow drift through the clowder.';
        }

        return cats.length > 0;
    } catch (error) {
        track.innerHTML = '<div class="cat-type-error" role="alert">Unable to load cat personalities right now. Please refresh or try again later.</div>';
        delete track.dataset.cardCount;
        if (statusEl) {
            statusEl.textContent = 'Unable to load cat personalities at the moment.';
        }
        return false;
    }
}

function createCatTypeCard(cat) {
    const attributes = Array.isArray(cat.attributes) ? cat.attributes : [];
    const attributeMarkup = attributes.map((attribute) => `<li class="cat-attribute">${attribute.label}: ${attribute.value}</li>`).join('');

    const taglineMarkup = cat.tagline ? `<span class="cat-type-pill">${cat.tagline}</span>` : '';

    const article = document.createElement('article');
    article.className = 'cat-type-card';
    article.setAttribute('data-animate', 'fade-up');
    article.innerHTML = `
        <div class="cat-type-image ratio ratio-4x3">
            <img src="${cat.image?.src || ''}" alt="${cat.image?.alt || cat.name || 'Cat photo'}">
        </div>
        <div class="cat-type-body p-4">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h3 class="h4 mb-0">${cat.name || 'Sweet Cat'}</h3>
                ${taglineMarkup}
            </div>
            <p>${cat.description || ''}</p>
            <ul class="cat-type-attributes list-unstyled d-flex flex-wrap gap-2 mb-0">
                ${attributeMarkup}
            </ul>
        </div>
    `;

    return article;
}

// Auto-scroll the cat type carousel every 3 seconds, pausing on hover
function setupCatCarousel(track) {
    const baseCard = track.querySelector('.cat-type-card');
    if (!baseCard || track.scrollWidth <= track.clientWidth) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const shouldRespectMotion = () => prefersReducedMotion.matches;

    const originalCount = Number(track.dataset.cardCount) || track.querySelectorAll('.cat-type-card').length;
    const originals = Array.from(track.querySelectorAll('.cat-type-card')).slice(0, originalCount);
    originals.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.classList.add('is-visible');
        clone.removeAttribute('data-animate');
        track.appendChild(clone);
    });

    let intervalId = null;
    let normalizeTimeout = null;
    let isHovered = false;
    let currentIndex = 0;

    const getGap = () => {
        const styles = window.getComputedStyle(track);
        const gapValue = parseFloat(styles.columnGap || styles.gap || '0');
        return Number.isNaN(gapValue) ? 0 : gapValue;
    };

    const getStepDistance = () => {
        const card = track.querySelector('.cat-type-card');
        if (!card) {
            return track.clientWidth;
        }
        return card.getBoundingClientRect().width + getGap();
    };

    const normalizePosition = () => {
        const stepDistance = getStepDistance();
        const loopWidth = stepDistance * originalCount;
        while (track.scrollLeft >= loopWidth) {
            track.scrollLeft -= loopWidth;
            currentIndex -= originalCount;
        }
    };

    const scheduleNormalize = () => {
        if (normalizeTimeout) {
            clearTimeout(normalizeTimeout);
        }
        normalizeTimeout = setTimeout(() => {
            normalizePosition();
            normalizeTimeout = null;
        }, 650);
    };

    const scrollNext = () => {
        currentIndex += 1;
        const targetLeft = currentIndex * getStepDistance();
        track.scrollTo({ left: targetLeft, behavior: 'smooth' });
        scheduleNormalize();
    };

    const start = () => {
        if (shouldRespectMotion() || isHovered) {
            stop();
            return;
        }
        if (!intervalId) {
            intervalId = setInterval(scrollNext, 3000);
        }
    };

    const stop = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (normalizeTimeout) {
            clearTimeout(normalizeTimeout);
            normalizeTimeout = null;
        }
    };

    const pauseAutoScroll = () => {
        if (!isHovered) {
            isHovered = true;
        }
        stop();
    };

    const resumeAutoScroll = () => {
        isHovered = false;
        start();
    };

    track.addEventListener('pointerenter', pauseAutoScroll);
    track.addEventListener('pointerleave', resumeAutoScroll);
    track.addEventListener('pointercancel', resumeAutoScroll);
    track.addEventListener('pointerup', resumeAutoScroll);
    track.addEventListener('touchend', resumeAutoScroll);
    track.addEventListener('touchcancel', resumeAutoScroll);
    track.addEventListener('mouseleave', resumeAutoScroll);

    track.addEventListener('scroll', () => {
        if (!isHovered) {
            currentIndex = Math.round(track.scrollLeft / getStepDistance());
        }
        if (!isHovered && !shouldRespectMotion() && !intervalId) {
            start();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stop();
        } else if (!isHovered) {
            start();
        }
    });

    const motionListener = () => {
        if (shouldRespectMotion()) {
            stop();
        } else {
            start();
        }
    };

    if (typeof prefersReducedMotion.addEventListener === 'function') {
        prefersReducedMotion.addEventListener('change', motionListener);
    } else if (typeof prefersReducedMotion.addListener === 'function') {
        prefersReducedMotion.addListener(motionListener);
    }

    start();
}
