const SHOP_AUTH_STORAGE_KEY = 'cosy-cat-shop-admin-auth-v1';
const SHOP_PRODUCTS_STORAGE_KEY = 'cosy-cat-shop-products-v1';
const SHOP_CART_KEY = 'cosy-cat-shop-cart-v1';
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', () => {
    initializeAllProductsPage();
});

async function initializeAllProductsPage() {
    applyProfileMenuState();

    const categoryFilterEl = document.getElementById('allProductsCategoryFilter');
    const searchInputEl = document.getElementById('allProductsSearchInput');
    const groupedResultsEl = document.getElementById('allProductsGroupedResults');
    const resultsMetaEl = document.getElementById('allProductsResultsMeta');

    if (!categoryFilterEl || !searchInputEl || !groupedResultsEl || !resultsMetaEl) {
        return;
    }

    const products = await loadManagedProducts();
    const normalizedProducts = Array.isArray(products) ? products.map(normalizeProduct) : [];

    populateCategoryFilter(normalizedProducts, categoryFilterEl);

    const render = () => {
        const selectedCategory = categoryFilterEl.value || 'all';
        const query = searchInputEl.value.trim().toLowerCase();

        const filtered = normalizedProducts.filter((product) => {
            const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
            const searchMatch = !query
                || product.name.toLowerCase().includes(query)
                || product.category.toLowerCase().includes(query)
                || product.description.toLowerCase().includes(query);
            return categoryMatch && searchMatch;
        });

        renderGroupedProducts(filtered, groupedResultsEl);
        const metaCategory = selectedCategory === 'all' ? 'all categories' : selectedCategory;
        resultsMetaEl.textContent = `${filtered.length} product(s) shown in ${metaCategory}.`;
    };

    categoryFilterEl.addEventListener('change', render);
    searchInputEl.addEventListener('input', render);

    groupedResultsEl.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const addButton = target.closest('.shop-add-btn');
        if (addButton instanceof HTMLElement) {
            addToCartFromButton(addButton);
            return;
        }

        const interactiveSelector = 'button, a, select, option, input, textarea, label';
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

    groupedResultsEl.addEventListener('keydown', (event) => {
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

    render();
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

function normalizeProduct(product) {
    const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Standard'];
    const colors = Array.isArray(product.colors) && product.colors.length ? product.colors : ['Default'];

    return {
        id: String(product.id || '').trim(),
        name: String(product.name || 'Cat-themed Product').trim(),
        category: String(product.category || 'General').trim(),
        description: String(product.description || '').trim(),
        price: Number.isFinite(product.price) ? product.price : Number.parseInt(String(product.price || '0'), 10) || 0,
        image: String(product.image || '').trim(),
        imageAlt: String(product.imageAlt || '').trim(),
        sizes,
        colors,
        defaultSize: String(product.defaultSize || sizes[0]).trim(),
        defaultColor: String(product.defaultColor || colors[0]).trim()
    };
}

function populateCategoryFilter(products, categoryFilterEl) {
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    categoryFilterEl.innerHTML = [
        '<option value="all">All categories</option>',
        ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join('');
}

function renderGroupedProducts(products, groupedResultsEl) {
    if (!products.length) {
        groupedResultsEl.innerHTML = '<div class="all-products-empty"><p class="mb-0">No products match your current filter and search.</p></div>';
        return;
    }

    const grouped = products.reduce((acc, product) => {
        const key = product.category || 'General';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(product);
        return acc;
    }, {});

    const categorySections = Object.keys(grouped)
        .sort((a, b) => a.localeCompare(b))
        .map((category) => {
            const cards = grouped[category].map((product) => {
                const productId = product.id || slugify(product.name || 'cat-item');
                const productUrl = `./product.html?id=${encodeURIComponent(productId)}`;
                const firstVariant = product.defaultSize || product.sizes[0] || 'Standard';
                const firstStyle = product.defaultColor || product.colors[0] || 'Default';
                const sizeOptions = (Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Standard'])
                    .map((size) => `<option value="${escapeHtml(size)}"${size === firstVariant ? ' selected' : ''}>${escapeHtml(size)}</option>`)
                    .join('');
                const colorOptions = (Array.isArray(product.colors) && product.colors.length ? product.colors : ['Default'])
                    .map((color) => `<option value="${escapeHtml(color)}"${color === firstStyle ? ' selected' : ''}>${escapeHtml(color)}</option>`)
                    .join('');
                const imageClass = /phone\s*case/i.test(product.category || '') ? 'shop-card-img shop-card-img--fit' : 'shop-card-img';
                return `
                    <div class="col-md-6 col-lg-3">
                        <article class="shop-card h-100 js-all-product-card js-product-card" data-product-url="${productUrl}" tabindex="0" role="link" aria-label="View details for ${escapeHtml(product.name)}">
                            <img src="${escapeHtml(product.image || 'https://placekitten.com/740/500')}" class="${imageClass}" alt="${escapeHtml(product.imageAlt || product.name)}">
                            <div class="shop-card-body">
                                <p class="shop-category-chip mb-2">${escapeHtml(product.category)}</p>
                                <h3 class="h5">${escapeHtml(product.name)}</h3>
                                <div class="shop-variant-grid mb-3">
                                    <label class="shop-variant-field">
                                        <span class="shop-variant-label">Variant</span>
                                        <select class="form-select form-select-sm" disabled>
                                            ${sizeOptions}
                                        </select>
                                    </label>
                                    <label class="shop-variant-field">
                                        <span class="shop-variant-label">Style</span>
                                        <select class="form-select form-select-sm" disabled>
                                            ${colorOptions}
                                        </select>
                                    </label>
                                </div>
                                <div class="shop-card-meta">
                                    <span class="shop-price">${CURRENCY_FORMAT.format(product.price)}</span>
                                    <div class="shop-card-actions">
                                        <button class="btn btn-sm btn-coral text-white shop-add-btn" type="button" data-product-id="${escapeHtml(productId)}" data-product-name="${escapeHtml(product.name)}" data-product-category="${escapeHtml(product.category)}" data-product-price="${Number.isFinite(product.price) ? product.price : 0}" data-product-size="${escapeHtml(firstVariant)}" data-product-color="${escapeHtml(firstStyle)}" aria-label="Add ${escapeHtml(product.name)} to cart">Add to cart</button>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>
                `;
            }).join('');

            return `
                <section class="all-products-category-group mb-4" aria-label="${escapeHtml(category)}">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h2 class="h4 mb-0">${escapeHtml(category)}</h2>
                        <span class="small text-muted">${grouped[category].length} item(s)</span>
                    </div>
                    <div class="row g-4">
                        ${cards}
                    </div>
                </section>
            `;
        }).join('');

    groupedResultsEl.innerHTML = categorySections;
}

function applyProfileMenuState() {
    const loginItems = document.querySelectorAll('.js-shop-login-item');
    const profileItems = document.querySelectorAll('.js-shop-profile-item');
    const dashboardItems = document.querySelectorAll('.js-shop-dashboard-item');
    const productManagementItems = document.querySelectorAll('.js-shop-product-management-item');
    const authDividers = document.querySelectorAll('.js-shop-auth-divider');
    const logoutButtons = document.querySelectorAll('.js-shop-logout-btn');

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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function addToCartFromButton(button) {
    const product = {
        id: String(button.dataset.productId || '').trim(),
        name: String(button.dataset.productName || 'Cat-themed Product').trim(),
        category: String(button.dataset.productCategory || 'General').trim(),
        price: Number.parseFloat(String(button.dataset.productPrice || '0')) || 0,
        size: String(button.dataset.productSize || 'Standard').trim(),
        color: String(button.dataset.productColor || 'Default').trim()
    };

    if (!product.id) {
        return;
    }

    const cart = loadCart();
    const existing = cart.find((item) => item.id === product.id && item.size === product.size && item.color === product.color);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart(cart);
}

function loadCart() {
    try {
        const raw = localStorage.getItem(SHOP_CART_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to read cart.', error);
        return [];
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem(SHOP_CART_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error('Failed to save cart.', error);
    }
}
