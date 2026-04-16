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
    applyProfileMenuState();
    initializeProductPage();
});

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

async function initializeProductPage() {
    renderProductLoadingState();
    const products = await loadManagedProducts();
    const productId = getRequestedProductId();

    if (!productId) {
        renderProductNotFound('No product was selected.');
        setupCart();
        return;
    }

    const selected = Array.isArray(products) ? products.find((product) => product.id === productId) : null;

    if (!selected) {
        renderProductNotFound('This product does not exist or may have been moved.');
        setupCart();
        return;
    }

    renderProductDetail(selected);
    setupCart();
}

async function loadManagedProducts() {
    const defaultProducts = await fetchJson('./data/products.json');
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

function getRequestedProductId() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    return id ? id.trim() : '';
}

function renderProductLoadingState() {
    const container = document.getElementById('productDetailContainer');
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="product-detail-panel">
            <div class="row g-0">
                <div class="col-lg-6">
                    <div class="shop-skeleton-block" style="height: 100%; min-height: 340px;"></div>
                </div>
                <div class="col-lg-6">
                    <div class="p-4">
                        <div class="shop-skeleton-block shop-skeleton-line-lg mb-3"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-md mb-2"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-sm mb-4"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-md mb-3"></div>
                        <div class="shop-skeleton-block shop-skeleton-line-md"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProductNotFound(message) {
    const container = document.getElementById('productDetailContainer');
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="product-not-found">
            <h1 class="h3 mb-2">Product not found</h1>
            <p class="mb-3">${escapeHtml(message)}</p>
            <a class="btn btn-coral text-white" href="./index.html#shop-products">Browse all products</a>
        </div>
    `;
}

function renderProductDetail(product) {
    const container = document.getElementById('productDetailContainer');
    if (!container) {
        return;
    }

    const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Standard'];
    const colors = Array.isArray(product.colors) && product.colors.length ? product.colors : ['Default'];
    const defaultSize = product.defaultSize || sizes[0];
    const defaultColor = product.defaultColor || colors[0];
    const price = Number.isFinite(product.price) ? product.price : 0;
    const category = String(product.category || 'General').trim();
    const detailImageClass = /phone\s*case/i.test(category) ? 'product-detail-image product-detail-image--fit' : 'product-detail-image';

    const sizeOptions = sizes.map((size) => `<option value="${escapeHtml(size)}"${size === defaultSize ? ' selected' : ''}>${escapeHtml(size)}</option>`).join('');
    const colorOptions = colors.map((color) => `<option value="${escapeHtml(color)}"${color === defaultColor ? ' selected' : ''}>${escapeHtml(color)}</option>`).join('');

    document.title = `${product.name || 'Product'} | Cosy Cat Shop`;

    container.innerHTML = `
        <article class="product-detail-panel">
            <div class="row g-0 align-items-stretch">
                <div class="col-lg-6">
                    <img class="${detailImageClass}" src="${escapeHtml(product.image || 'https://placekitten.com/900/680')}" alt="${escapeHtml(product.imageAlt || product.name || 'Cat-themed product')}" loading="eager">
                </div>
                <div class="col-lg-6">
                    <div class="product-detail-body">
                        <p class="section-label mb-2">Product details</p>
                        <p class="shop-category-chip mb-2">${escapeHtml(category)}</p>
                        <h1 class="display-6 mb-3">${escapeHtml(product.name || 'Cat-themed Product')}</h1>
                        <p class="mb-3">${escapeHtml(product.description || '')}</p>
                        <p class="product-detail-price mb-4">${CURRENCY_FORMAT.format(price)}</p>
                        <div class="shop-variant-grid mb-4">
                            <label class="shop-variant-field">
                                <span class="shop-variant-label">Variant</span>
                                <select class="form-select form-select-sm shop-size-select" aria-label="Select product variant">
                                    ${sizeOptions}
                                </select>
                            </label>
                            <label class="shop-variant-field">
                                <span class="shop-variant-label">Style</span>
                                <select class="form-select form-select-sm shop-color-select" aria-label="Select product style">
                                    ${colorOptions}
                                </select>
                            </label>
                        </div>
                        <div class="product-detail-actions">
                            <button class="btn btn-coral text-white shop-add-btn" type="button" data-product-id="${escapeHtml(product.id || slugify(product.name || 'cat-item'))}" data-product-name="${escapeHtml(product.name || 'Cat-themed Product')}" data-product-category="${escapeHtml(category)}" data-product-price="${price}">Add to cart</button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
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

function setupCart() {
    const openCartBtn = document.getElementById('openCartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
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

    if (!cartDrawer || !cartBackdrop || !cartItemsEl || !cartEmptyEl || !subtotalEl || !cartCountEl) {
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

    const getCartCharges = () => {
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('shop-add-btn')) {
            return;
        }

        const product = getProductFromButton(target);
        const existing = cart.find((item) => item.id === product.id);

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }

        saveAndRender();
        showToast(`Added ${product.name} (${product.size}, ${product.color})`);
    });

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
            showToast('Checkout coming soon');
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
    const context = button.closest('.product-detail-panel, .shop-card');
    const fallbackName = context?.querySelector('h1, h3')?.textContent?.trim() || 'Cat Goodie';
    const rawName = button.dataset.productName || fallbackName;
    const rawPrice = button.dataset.productPrice || '0';
    const price = Number.parseFloat(rawPrice.replace(/[^\d.]/g, '')) || 0;
    const selectedSize = context?.querySelector('.shop-size-select')?.value || 'Standard';
    const selectedColor = context?.querySelector('.shop-color-select')?.value || 'Default';
    const categoryChip = context?.querySelector('.shop-category-chip')?.textContent?.trim();
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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}
