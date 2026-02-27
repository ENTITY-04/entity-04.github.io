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

function loadCatTypes(track) {
    const $statusEl = $('#catTypeStatus');

    return $.ajax({
        url: 'https://api.thecatapi.com/v1/breeds',
        method: 'GET',
        data: { limit: 20 },
        dataType: 'json'
    })
        .then((breeds) => {
            const normalizedCats = normalizeBreedData(breeds).slice(0, 9);
            if (!normalizedCats.length) {
                throw new Error('No cat data returned');
            }

            track.innerHTML = '';
            const observer = getRevealObserver();

            normalizedCats.forEach((cat) => {
                const card = createCatTypeCard(cat);
                track.appendChild(card);
                if (observer) {
                    observer.observe(card);
                }
            });

            track.dataset.cardCount = String(normalizedCats.length);
            track.dataset.catTypes = encodeURIComponent(JSON.stringify(normalizedCats));

            assignFeaturedCats(normalizedCats);

            if ($statusEl.length) {
                $statusEl.text('Enjoy the slow drift through the clowder.');
            }

            return true;
        })
        .catch((error) => {
            track.innerHTML = '<div class="cat-type-error" role="alert">Unable to load cat personalities right now. Please refresh or try again later.</div>';
            delete track.dataset.cardCount;
            delete track.dataset.catTypes;
            if ($statusEl.length) {
                $statusEl.text('Unable to load cat personalities at the moment.');
            }
            console.error('Failed to load cat personalities.', error);
            return false;
        });
}

function normalizeBreedData(breeds) {
    if (!Array.isArray(breeds)) {
        return [];
    }

    return breeds
        .filter((breed) => !!breed)
        .map((breed, index) => ({
            name: breed.name || 'Mystery Cat',
            tagline: extractTagline(breed.temperament),
            description: breed.description || 'This cat is still writing their story.',
            image: buildImagePayload(breed, index),
            attributes: buildAttributes(breed)
        }));
}

function extractTagline(temperament) {
    if (!temperament) {
        return 'Charming Companion';
    }
    return temperament.split(',')[0].trim();
}

function buildAttributes(breed) {
    return [
        {
            label: 'Energy',
            value: levelToDescriptor(breed.energy_level)
        },
        {
            label: 'Coat',
            value: formatCoatLabel(breed)
        },
        {
            label: 'Affection',
            value: levelToDescriptor(breed.affection_level)
        }
    ];
}

function levelToDescriptor(level) {
    const scale = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
    if (!Number.isFinite(level)) {
        return 'Varies';
    }
    const idx = Math.min(Math.max(Math.round(level) - 1, 0), scale.length - 1);
    return scale[idx];
}

function formatCoatLabel(breed) {
    if (breed?.coat) {
        return breed.coat.split(',')[0].trim();
    }
    if (breed?.hairless) {
        return 'Hairless';
    }
    if (breed?.origin) {
        return `${breed.origin} native`;
    }
    return 'Varied';
}

function buildImagePayload(breed, index) {
    const src = selectBestImageUrl(breed) || getFallbackImage(index);
    return {
        src,
        alt: `${breed?.name || 'Cat'} lounging`
    };
}

function selectBestImageUrl(breed) {
    if (breed?.image?.url) {
        return ensureHttps(breed.image.url);
    }
    if (breed?.reference_image_id) {
        return `https://cdn2.thecatapi.com/images/${breed.reference_image_id}.jpg`;
    }
    return null;
}

function getFallbackImage(index) {
    const base = 600 + (index % 5) * 10;
    return `https://placekitten.com/${base}/${base - 40}`;
}

function ensureHttps(url) {
    if (!url) {
        return url;
    }
    if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
    }
    return url;
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
            <img src="${cat.image?.src || ''}" alt="${cat.image?.alt || cat.name || 'Cat photo'}" loading="lazy">
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

function assignFeaturedCats(cats) {
    if (!Array.isArray(cats) || !cats.length) {
        return;
    }

    const heroCat = cats[0];
    const aboutCat = cats[1] || heroCat;
    const communityCat = cats[2] || aboutCat;

    applyCatToFeature({ imgId: 'heroCatImg', labelId: 'heroCatLabel', showTagline: false }, heroCat);
    applyCatToFeature({ imgId: 'aboutCatImg', labelId: 'aboutCatLabel', showTagline: false }, aboutCat);
    applyCatToFeature({ imgId: 'communityCatImg', labelId: 'communityCatLabel', showTagline: false }, communityCat);
}

function applyCatToFeature(target, cat) {
    if (!cat) {
        return;
    }

    const imageEl = document.getElementById(target.imgId);
    const labelEl = document.getElementById(target.labelId);

    if (imageEl) {
        const src = cat.image?.src || getFallbackImage(0);
        imageEl.src = src;
        imageEl.alt = cat.image?.alt || `${cat.name || 'Cat'} relaxing`;
        imageEl.loading = 'lazy';
    }

    if (labelEl) {
        const showTagline = target.showTagline !== false;
        labelEl.textContent = cat.name
            ? `${cat.name}${showTagline && cat.tagline ? ` • ${cat.tagline}` : ''}`
            : '';
    }
}

// Auto-scroll the cat type carousel continuously by recycling data
function setupCatCarousel(track) {
    const baseCard = track.querySelector('.cat-type-card');
    if (!baseCard || track.scrollWidth <= track.clientWidth) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const shouldPauseForMotion = () => prefersReducedMotion.matches;

    const storedData = track.dataset.catTypes ? JSON.parse(decodeURIComponent(track.dataset.catTypes)) : [];
    const totalData = storedData.length;
    let nextDataIndex = totalData;

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

    const appendNextCard = () => {
        let cardToAppend;
        if (totalData) {
            const data = storedData[nextDataIndex % totalData];
            nextDataIndex += 1;
            cardToAppend = createCatTypeCard(data);
        } else {
            cardToAppend = track.firstElementChild ? track.firstElementChild.cloneNode(true) : null;
        }

        if (cardToAppend) {
            cardToAppend.classList.add('is-visible');
            cardToAppend.removeAttribute('data-animate');
            track.appendChild(cardToAppend);
        }
    };

    const transitionDuration = 600;
    let intervalId = null;
    let isAnimating = false;

    const cycleCards = () => {
        const step = getStepDistance();
        if (step <= 0) {
            return;
        }
        isAnimating = true;
        track.scrollBy({ left: step, behavior: 'smooth' });
        setTimeout(() => {
            const firstCard = track.querySelector('.cat-type-card');
            if (firstCard) {
                firstCard.remove();
                appendNextCard();
                track.scrollLeft = Math.max(track.scrollLeft - step, 0);
            }
            isAnimating = false;
        }, transitionDuration);
    };

    const tick = () => {
        if (shouldPauseForMotion() || isAnimating) {
            return;
        }
        cycleCards();
    };

    const start = () => {
        if (intervalId || shouldPauseForMotion()) {
            return;
        }
        intervalId = setInterval(tick, 3000);
    };

    const stop = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    window.addEventListener('resize', () => {
        track.scrollLeft = 0;
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stop();
        } else {
            start();
        }
    });

    const motionListener = () => {
        if (shouldPauseForMotion()) {
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
