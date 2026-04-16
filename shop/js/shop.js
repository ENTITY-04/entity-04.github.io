let revealObserver = null;
let shopProductsCache = [];
let shopActiveCategory = 'all';
let shopAutoplayTimer = null;
const SHOP_CART_KEY = 'cosy-cat-shop-cart-v1';
const SHOP_AUTH_STORAGE_KEY = 'cosy-cat-shop-admin-auth-v1';
const SHOP_PRODUCTS_STORAGE_KEY = 'cosy-cat-shop-products-v1';
const SHOP_DELIVERY_FEE = 10;
const SHOP_SST_RATE = 0.06;
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', () => {
    initializeShop();
});

async function initializeShop() {
    applyProfileMenuState();
    renderLoadingSkeletons();
    await loadShopData();
    setupRevealAnimations();
    setupCart();
}

function applyProfileMenuState() {
    const loginItems = document.querySelectorAll('.js-shop-login-item');
    const profileItems = document.querySelectorAll('.js-shop-profile-item');
    const dashboardItems = document.querySelectorAll('.js-shop-dashboard-item');
    const productManagementItems = document.querySelectorAll('.js-shop-product-management-item');
    const authDividers = document.querySelectorAll('.js-shop-auth-divider');
    const logoutButtons = document.querySelectorAll('.js-shop-logout-btn');
    if (!loginItems.length) {
        return;
    }

    let session = null;
    try {
        const raw = localStorage.getItem(SHOP_AUTH_STORAGE_KEY);
        session = raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Failed to read shop auth session.', error);
    }
    const isLoggedIn = !!session?.username;
    const isAdmin = isLoggedIn && session.role === 'admin';

    loginItems.forEach((item) => {
        item.classList.toggle('d-none', isLoggedIn);
    });
    profileItems.forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });
    dashboardItems.forEach((item) => {
        item.classList.toggle('d-none', !isAdmin);
    });
    productManagementItems.forEach((item) => {
        item.classList.toggle('d-none', !isAdmin);
    });
    authDividers.forEach((divider) => {
        divider.classList.toggle('d-none', !isLoggedIn);
    });

    logoutButtons.forEach((button) => {
        button.onclick = (event) => {
            event.preventDefault();
            localStorage.removeItem(SHOP_AUTH_STORAGE_KEY);
            window.location.reload();
        };
    });
}

function renderLoadingSkeletons() {
    const productsGrid = document.getElementById('shopProductsGrid');
    const reviewsGrid = document.getElementById('shopReviewsGrid');

    if (productsGrid) {
        productsGrid.innerHTML = Array.from({ length: 4 }, () => `
            <div class="col-md-6 col-xl-3">
                <div class="shop-skeleton-card" aria-hidden="true">
                    <div class="shop-skeleton-block shop-skeleton-image"></div>
                    <div class="shop-skeleton-content">
                        <div class="shop-skeleton-block shop-skeleton-line-lg"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-md"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-sm"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-md"></div>
                    </div>
                    <div class="shop-skeleton-shimmer"></div>
                </div>
            </div>
        `).join('');
    }

    if (reviewsGrid) {
        reviewsGrid.innerHTML = Array.from({ length: 3 }, () => `
            <div class="col-md-4">
                <div class="shop-skeleton-review p-4" aria-hidden="true">
                    <div class="shop-skeleton-block shop-skeleton-line-md mb-2"></div>
                    <div class="shop-skeleton-block shop-skeleton-line-md mb-2"></div>
                    <div class="shop-skeleton-block shop-skeleton-line-sm"></div>
                    <div class="shop-skeleton-shimmer"></div>
                </div>
            </div>
        `).join('');
    }
}

async function loadShopData() {
    const [products, reviews] = await Promise.all([
        loadManagedCollection('./data/products.json'),
        fetchJson('./data/reviews.json')
    ]);

    shopProductsCache = Array.isArray(products) ? products : [];
    setupProductFilter(shopProductsCache);
    renderProducts(getFilteredProducts());
    setupProductAutoplay();
    renderReviews(Array.isArray(reviews) ? reviews : []);
}

function getFilteredProducts() {
    if (shopActiveCategory === 'all') {
        return shopProductsCache;
    }

    return shopProductsCache.filter((product) => String(product.category || 'General').trim() === shopActiveCategory);
}

function setupProductFilter(products) {
    const filterBtn = document.getElementById('shopProductsFilterBtn');
    const filterMenu = document.getElementById('shopProductsFilterMenu');
    if (!filterBtn || !filterMenu) {
        return;
    }

    const categories = [...new Set((Array.isArray(products) ? products : [])
        .map((product) => String(product.category || 'General').trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    filterMenu.innerHTML = [
        '<li><button class="dropdown-item active" type="button" data-category="all">All</button></li>',
        ...categories.map((category) => `<li><button class="dropdown-item" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button></li>`)
    ].join('');

    filterMenu.onclick = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest('[data-category]');
        if (!(button instanceof HTMLElement)) {
            return;
        }

        shopActiveCategory = button.dataset.category || 'all';
        const label = shopActiveCategory === 'all' ? 'All' : shopActiveCategory;
        filterBtn.textContent = `Filter: ${label}`;

        filterMenu.querySelectorAll('.dropdown-item').forEach((item) => {
            item.classList.toggle('active', item === button);
        });

        renderProducts(getFilteredProducts());
        setupProductAutoplay();
    };
}

async function loadManagedCollection(defaultPath) {
    const defaultProducts = await fetchJson(defaultPath);
    if (!shouldUsePreviewProducts()) {
        return defaultProducts;
    }

    const storedProducts = readStoredProducts();
    if (storedProducts) {
        return storedProducts;
    }

    return defaultProducts;
}

function shouldUsePreviewProducts() {
    const params = new URLSearchParams(window.location.search);
    return params.get('preview') === '1';
}

function readStoredProducts() {
    try {
        const raw = localStorage.getItem(SHOP_PRODUCTS_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        console.error('Failed to read stored products.', error);
        return null;
    }
}

async function fetchJson(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load ${path}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

function renderProducts(products) {
    const grid = document.getElementById('shopProductsGrid');
    if (!grid) {
        return;
    }

    if (!products.length) {
        grid.innerHTML = '<div class="col-12"><p class="text-muted mb-0">No products available right now.</p></div>';
        grid.classList.remove('shop-products-track');
        return;
    }

    grid.classList.add('shop-products-track');

    grid.innerHTML = products.map((product) => {
        const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Standard'];
        const colors = Array.isArray(product.colors) && product.colors.length ? product.colors : ['Default'];
        const defaultSize = product.defaultSize || sizes[0];
        const defaultColor = product.defaultColor || colors[0];
        const productId = product.id || slugify(product.name || 'cat-item');
        const productUrl = `./product.html?id=${encodeURIComponent(productId)}`;

        const sizeOptions = sizes.map((size) => `<option value="${escapeHtml(size)}"${size === defaultSize ? ' selected' : ''}>${escapeHtml(size)}</option>`).join('');
        const colorOptions = colors.map((color) => `<option value="${escapeHtml(color)}"${color === defaultColor ? ' selected' : ''}>${escapeHtml(color)}</option>`).join('');
        const price = Number.isFinite(product.price) ? product.price : 0;
        const category = String(product.category || 'General').trim();
        const imageClass = /phone\s*case/i.test(category) ? 'shop-card-img shop-card-img--fit' : 'shop-card-img';

        return `
            <div class="shop-product-slide">
                <article class="shop-card h-100 js-product-card" data-product-url="${productUrl}" tabindex="0" role="link" aria-label="View details for ${escapeHtml(product.name || 'Cat-themed Product')}">
                    <img src="${escapeHtml(product.image || 'https://placekitten.com/740/500')}" class="${imageClass}" alt="${escapeHtml(product.imageAlt || product.name || 'Cat-themed product')}">
                    <div class="shop-card-body">
                        <p class="shop-category-chip mb-2">${escapeHtml(category)}</p>
                        <h3 class="h5">${escapeHtml(product.name || 'Cat-themed Product')}</h3>
                        <div class="shop-variant-grid mb-3">
                            <label class="shop-variant-field">
                                <span class="shop-variant-label">Variant</span>
                                <select class="form-select form-select-sm shop-size-select" aria-label="Select ${escapeHtml((product.name || 'product').toLowerCase())} variant">
                                    ${sizeOptions}
                                </select>
                            </label>
                            <label class="shop-variant-field">
                                <span class="shop-variant-label">Style</span>
                                <select class="form-select form-select-sm shop-color-select" aria-label="Select ${escapeHtml((product.name || 'product').toLowerCase())} style">
                                    ${colorOptions}
                                </select>
                            </label>
                        </div>
                        <div class="shop-card-meta">
                            <span class="shop-price">${CURRENCY_FORMAT.format(price)}</span>
                            <div class="shop-card-actions">
                                <button class="btn btn-sm btn-coral text-white shop-add-btn" type="button" data-product-id="${escapeHtml(productId)}" data-product-name="${escapeHtml(product.name || 'Cat-themed Product')}" data-product-category="${escapeHtml(category)}" data-product-price="${price}" aria-label="Add ${escapeHtml(product.name || 'Cat-themed Product')} to cart">Add to cart</button>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        `;
    }).join('');
}

function setupProductAutoplay() {
    const grid = document.getElementById('shopProductsGrid');
    if (!grid) {
        return;
    }

    if (shopAutoplayTimer) {
        clearInterval(shopAutoplayTimer);
        shopAutoplayTimer = null;
    }

    const firstSlide = grid.querySelector('.shop-product-slide');
    if (!(firstSlide instanceof HTMLElement)) {
        return;
    }

    const advance = () => {
        const slideWidth = firstSlide.getBoundingClientRect().width;
        if (!slideWidth) {
            return;
        }

        const gap = 16;
        const maxScroll = grid.scrollWidth - grid.clientWidth;
        if (grid.scrollLeft >= maxScroll - 8) {
            grid.scrollTo({ left: 0, behavior: 'smooth' });
            return;
        }

        grid.scrollBy({ left: slideWidth + gap, behavior: 'smooth' });
    };

    shopAutoplayTimer = setInterval(advance, 2800);

    if (!grid.dataset.autoplayBound) {
        grid.addEventListener('mouseenter', () => {
            if (shopAutoplayTimer) {
                clearInterval(shopAutoplayTimer);
                shopAutoplayTimer = null;
            }
        });

        grid.addEventListener('mouseleave', () => {
            setupProductAutoplay();
        });

        grid.addEventListener('focusin', () => {
            if (shopAutoplayTimer) {
                clearInterval(shopAutoplayTimer);
                shopAutoplayTimer = null;
            }
        });

        grid.addEventListener('focusout', () => {
            setupProductAutoplay();
        });

        grid.dataset.autoplayBound = 'true';
    }
}

function renderReviews(reviews) {
    const grid = document.getElementById('shopReviewsGrid');
    if (!grid) {
        return;
    }

    if (!reviews.length) {
        grid.innerHTML = '<div class="col-12"><p class="text-muted mb-0">No reviews yet.</p></div>';
        return;
    }

    grid.innerHTML = reviews.map((review) => `
        <div class="col-md-4" data-animate="fade-up">
            <blockquote class="shop-review h-100">
                <p>"${escapeHtml(review.quote || '')}"</p>
                <footer>- ${escapeHtml(review.author || 'Cat Parent')}</footer>
            </blockquote>
        </div>
    `).join('');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setupRevealAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    if (!animatedElements.length) {
        return;
    }

    const observer = getRevealObserver();
    animatedElements.forEach((el) => observer.observe(el));
}

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

function setupCart() {
    const addButtons = document.querySelectorAll('.shop-add-btn');
    const productsGrid = document.getElementById('shopProductsGrid');
    const openCartBtn = document.getElementById('openCartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutHint = document.getElementById('shopCheckoutHint');
    const cartCountEl = document.getElementById('shopCartCount');
    const cartDrawer = document.getElementById('shopCartDrawer');
    const cartBackdrop = document.getElementById('shopCartBackdrop');
    const cartItemsEl = document.getElementById('shopCartItems');
    const cartEmptyEl = document.getElementById('shopCartEmpty');
    const subtotalEl = document.getElementById('shopCartSubtotal');
    const deliveryFeeEl = document.getElementById('shopCartDeliveryFee');
    const sstTaxEl = document.getElementById('shopCartSstTax');
    const totalEl = document.getElementById('shopCartTotal');
    const toast = document.getElementById('shopCartToast');
    const checkoutModalEl = document.getElementById('checkoutModal');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutModalTotal = document.getElementById('checkoutModalTotal');
    const checkoutCardNumberInput = document.getElementById('checkoutCardNumber');
    const checkoutExpiryInput = document.getElementById('checkoutExpiry');
    const checkoutCvvInput = document.getElementById('checkoutCvv');
    const bootstrapModal = checkoutModalEl && window.bootstrap?.Modal ? new window.bootstrap.Modal(checkoutModalEl) : null;

    if (!addButtons.length || !cartDrawer || !cartBackdrop || !cartItemsEl || !cartEmptyEl || !subtotalEl || !cartCountEl) {
        return;
    }

    let cart = loadCart();
    let toastTimer = null;

    const showToast = (message) => {
        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.add('is-visible');
        if (toastTimer) {
            clearTimeout(toastTimer);
        }

        toastTimer = setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 1400);
    };

    const saveAndRender = () => {
        saveCart(cart);
        renderCart();
    };

    const getCartSubtotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const getCartCharges = () => {
        const subtotal = getCartSubtotal();
        const deliveryFee = cart.length ? SHOP_DELIVERY_FEE : 0;
        const sstTax = subtotal * SHOP_SST_RATE;
        const total = subtotal + deliveryFee + sstTax;
        return { subtotal, deliveryFee, sstTax, total };
    };

    const openCart = () => {
        cartDrawer.classList.add('is-open');
        cartDrawer.setAttribute('aria-hidden', 'false');
        cartBackdrop.hidden = false;
        requestAnimationFrame(() => {
            cartBackdrop.classList.add('is-visible');
        });
        document.body.style.overflow = 'hidden';
    };

    const closeCart = () => {
        cartDrawer.classList.remove('is-open');
        cartDrawer.setAttribute('aria-hidden', 'true');
        cartBackdrop.classList.remove('is-visible');
        setTimeout(() => {
            cartBackdrop.hidden = true;
        }, 220);
        document.body.style.overflow = '';
    };

    const renderCart = () => {
        cartItemsEl.innerHTML = '';

        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const charges = getCartCharges();

        cartCountEl.textContent = String(totalItems);
        subtotalEl.textContent = CURRENCY_FORMAT.format(charges.subtotal);
        if (deliveryFeeEl) {
            deliveryFeeEl.textContent = CURRENCY_FORMAT.format(charges.deliveryFee);
        }
        if (sstTaxEl) {
            sstTaxEl.textContent = CURRENCY_FORMAT.format(charges.sstTax);
        }
        if (totalEl) {
            totalEl.textContent = CURRENCY_FORMAT.format(charges.total);
        }
        cartEmptyEl.hidden = cart.length > 0;
        if (checkoutBtn) {
            checkoutBtn.disabled = cart.length === 0;
            checkoutBtn.classList.toggle('d-none', cart.length === 0);
        }
        if (checkoutHint) {
            checkoutHint.classList.toggle('d-none', cart.length > 0);
        }
        if (clearCartBtn) {
            clearCartBtn.disabled = cart.length === 0;
        }

        cart.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'shop-cart-item';
            li.innerHTML = `
                <div class="shop-cart-item-name">${item.name}</div>
                <div class="shop-cart-item-price">${CURRENCY_FORMAT.format(item.price)} each</div>
                <div class="shop-cart-item-price">Category: ${item.category || 'General'}</div>
                <div class="shop-cart-item-price">Variant: ${item.size || 'Standard'} • Style: ${item.color || 'Default'}</div>
                <div class="shop-cart-item-controls">
                    <div class="shop-qty-group" aria-label="Quantity controls">
                        <button class="shop-qty-btn" type="button" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                        <span class="shop-qty-value" aria-live="polite">${item.quantity}</span>
                        <button class="shop-qty-btn" type="button" data-action="increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
                    </div>
                    <button class="shop-remove-btn" type="button" data-action="remove" data-id="${item.id}">Remove</button>
                </div>
            `;
            cartItemsEl.appendChild(li);
        });
    };

    addButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const product = getProductFromButton(btn);
            const existing = cart.find((item) => item.id === product.id);

            if (existing) {
                existing.quantity += 1;
            } else {
                cart.push({ ...product, quantity: 1 });
            }

            saveAndRender();
            showToast(`Added ${product.name} (${product.size}, ${product.color})`);
        });
    });

    if (productsGrid) {
        const interactiveSelector = 'button, a, select, option, input, textarea, label';

        productsGrid.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            if (target.closest(interactiveSelector)) {
                return;
            }

            const card = target.closest('.js-product-card');
            if (!(card instanceof HTMLElement)) {
                return;
            }

            const url = card.dataset.productUrl;
            if (url) {
                window.location.href = url;
            }
        });

        productsGrid.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.classList.contains('js-product-card')) {
                return;
            }

            event.preventDefault();
            const url = target.dataset.productUrl;
            if (url) {
                window.location.href = url;
            }
        });
    }

    cartItemsEl.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const action = target.dataset.action;
        const id = target.dataset.id;
        if (!action || !id) {
            return;
        }

        const index = cart.findIndex((item) => item.id === id);
        if (index < 0) {
            return;
        }

        if (action === 'increase') {
            cart[index].quantity += 1;
        } else if (action === 'decrease') {
            cart[index].quantity -= 1;
            if (cart[index].quantity <= 0) {
                cart.splice(index, 1);
            }
        } else if (action === 'remove') {
            cart.splice(index, 1);
        }

        saveAndRender();
    });

    if (openCartBtn) {
        openCartBtn.addEventListener('click', openCart);
    }
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', closeCart);
    }
    cartBackdrop.addEventListener('click', closeCart);

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            cart = [];
            saveAndRender();
            showToast('Cart cleared');
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (!cart.length) {
                showToast('Add items before checkout');
                return;
            }

            if (!bootstrapModal || !checkoutForm || !checkoutModalTotal) {
                showToast('Checkout is temporarily unavailable');
                return;
            }

            checkoutModalTotal.textContent = CURRENCY_FORMAT.format(getCartCharges().total);
            bootstrapModal.show();
        });
    }

    if (checkoutCardNumberInput) {
        checkoutCardNumberInput.addEventListener('input', () => {
            const digits = checkoutCardNumberInput.value.replace(/\D/g, '').slice(0, 16);
            checkoutCardNumberInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
        });
    }

    if (checkoutExpiryInput) {
        checkoutExpiryInput.addEventListener('input', () => {
            const digits = checkoutExpiryInput.value.replace(/\D/g, '').slice(0, 4);
            if (digits.length < 3) {
                checkoutExpiryInput.value = digits;
                return;
            }
            checkoutExpiryInput.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        });
    }

    if (checkoutCvvInput) {
        checkoutCvvInput.addEventListener('input', () => {
            checkoutCvvInput.value = checkoutCvvInput.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!cart.length) {
                showToast('Your cart is empty');
                return;
            }

            const formData = new FormData(checkoutForm);
            const cardName = String(formData.get('cardName') || '').trim();
            const cardNumber = String(formData.get('cardNumber') || '').replace(/\s/g, '');
            const expiry = String(formData.get('expiry') || '').trim();
            const cvv = String(formData.get('cvv') || '').trim();

            const isCardNameValid = cardName.length >= 2;
            const isCardNumberValid = /^\d{16}$/.test(cardNumber);
            const isExpiryValid = /^(0[1-9]|1[0-2])\/(\d{2})$/.test(expiry);
            const isCvvValid = /^\d{3,4}$/.test(cvv);

            if (!isCardNameValid || !isCardNumberValid || !isExpiryValid || !isCvvValid) {
                showToast('Please fill valid card details');
                return;
            }

            cart = [];
            saveAndRender();
            checkoutForm.reset();
            bootstrapModal?.hide();
            closeCart();
            showToast('Payment successful. Thanks for your order!');
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && cartDrawer.classList.contains('is-open')) {
            closeCart();
        }
    });

    renderCart();
}

function getProductFromButton(button) {
    const card = button.closest('.shop-card');
    const fallbackName = card?.querySelector('h3')?.textContent?.trim() || 'Cat Goodie';
    const rawName = button.dataset.productName || fallbackName;
    const rawPrice = button.dataset.productPrice || '0';
    const price = Number.parseFloat(rawPrice.replace(/[^\d.]/g, '')) || 0;
    const selectedSize = card?.querySelector('.shop-size-select')?.value || 'Standard';
    const selectedColor = card?.querySelector('.shop-color-select')?.value || 'Default';
    const categoryChip = card?.querySelector('.shop-category-chip')?.textContent?.trim();
    const category = button.dataset.productCategory || categoryChip || 'General';
    const baseId = button.dataset.productId || slugify(rawName);
    const variantId = `${baseId}::${slugify(selectedSize)}::${slugify(selectedColor)}`;

    return {
        id: variantId,
        name: rawName,
        category,
        price,
        size: selectedSize,
        color: selectedColor
    };
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function loadCart() {
    try {
        const stored = localStorage.getItem(SHOP_CART_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter((item) => item && item.id && item.name && Number.isFinite(item.price) && Number.isFinite(item.quantity) && item.quantity > 0)
            .map((item) => ({
                ...item,
                category: item.category || 'General',
                size: item.size || 'Standard',
                color: item.color || 'Default'
            }));
    } catch (error) {
        console.error('Unable to load cart.', error);
        return [];
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem(SHOP_CART_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error('Unable to save cart.', error);
    }
}
