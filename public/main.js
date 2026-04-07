const currencyDisplay = document.getElementById("currency-display");

let currentUser = JSON.parse(localStorage.getItem('crazy_user'));
let cart = []; 
let wishlist = [];
let discountAmount = 0;

async function initApp() {
    if (currentUser) {
        console.log("Logged in as:", currentUser.username);
        
        const cartData = await fetchJSON(`/api/cart/${currentUser.id}`);
        cart = cartData.map(item => ({
            id: item.product,
            name: item.name,
            price: item.price,
            img: item.image_url,
            quantity: item.quantity,
            stock: item.stock
        }));

        const wishData = await fetchJSON(`/api/wishlist/${currentUser.id}`);
        wishlist = wishData.map(item => ({
            id: item.product,
            name: item.name,
            price: item.price,
            image: item.image_url
        }));

    } else {
        console.log("Guest Mode");
        cart = JSON.parse(localStorage.getItem('crazy_cart')) || [];
        wishlist = JSON.parse(localStorage.getItem('crazy_wishlist')) || [];
    }

    updateCartUI();
    if (window.location.pathname.includes('wishlist.html')) renderWishlistPage();
}

initApp();

async function loadDynamicCategories() {
    try {
        const categories = await fetchJSON('/api/categories');
        
        const subMenu = document.querySelector('.sub-menu');
        if (subMenu) {
            subMenu.innerHTML = categories.map(cat => 
                `<li><a href="product.html#${cat._id}">${cat.name}</a></li>`
            ).join('');
        }

        if (window.location.pathname.includes('product.html')) {
            const contentDiv = document.getElementById('content');
            if (contentDiv) {
                contentDiv.innerHTML = ''; 

                for (const cat of categories) {
                    const section = document.createElement('section');
                    section.className = 'product-section';
                    section.id = cat._id;
                    section.innerHTML = `
                        <h3>${cat.name}</h3>
                        <div class="products-grid" id="grid-${cat._id}">
                            <div class="loading">Loading...</div>
                        </div>
                    `;
                    contentDiv.appendChild(section);

                    fetchJSON(`/api/products?category=${encodeURIComponent(cat.name)}`)
                        .then(products => {
                            const grid = document.getElementById(`grid-${cat._id}`);
                            renderGrid(grid, products);
                        });
                }
            }
        }
    } catch (err) { console.error("Error loading categories:", err); }
}

loadDynamicCategories();

let currentCurrency = localStorage.getItem('crazy_currency') || 'USD';

if (currencyDisplay) {
    currencyDisplay.textContent = currentCurrency;
}

function formatPrice(priceUSD) {
    const currency = localStorage.getItem('crazy_currency') || 'USD';
    
    if (currency === 'VND') {
        return (Math.round(priceUSD * 25000)).toLocaleString('vi-VN') + ' ₫';
    }
    return '$' + parseFloat(priceUSD).toFixed(2);
}

function switchCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('crazy_currency', currency);
    location.reload();
}

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (err) { console.error("Error:", err); return []; }
}

function createProductCard(p, isWishlistPage = false) {
    const imgUrl = p.image_url;
    
    const isLiked = wishlist.some(item => item.id === p._id);
    const heartClass = isLiked ? 'fa-heart active' : 'fa-heart';

    let actionBtn = '';
    if (isWishlistPage) {
        actionBtn = `<button class="btn-remove-wishlist" onclick="toggleWishlist('${p._id}', '${p.name}', ${p.price}, '${imgUrl}')">Remove</button>`;
    }

    const isOutOfStock = p.stock <= 0;

    const stockBadge = isOutOfStock 
        ? `<span style="position:absolute; top:10px; left:10px; background:#ff4757; color:white; padding:4px 8px; font-size:12px; border-radius:4px; font-weight:bold; z-index:10; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">SOLD OUT</span>` 
        : '';

    const clickEvent = isOutOfStock 
        ? `onclick="event.preventDefault(); alert('Sorry, this item is out of stock!');"` 
        : `href="product-detail.html?id=${p._id}"`;

    const cardStyle = isOutOfStock ? 'opacity: 0.6;' : '';


    return `
        <article class="product-card" style="${cardStyle}">
            
            ${stockBadge} <a ${clickEvent} style="text-decoration:none; color:inherit;">
                <div class="thumb" style="background-image: url('${imgUrl}')"></div>
                <div class="info">
                    <h4>${p.name}</h4>
                    <div class="price">${formatPrice(p.price)}</div>
                </div>
            </a>

            ${!isWishlistPage ? `
            <div style="padding: 0 14px 14px; display:flex; justify-content:space-between;">
                <i class="fa ${heartClass}" style="cursor:pointer; font-size:18px;" 
                   onclick="event.preventDefault(); toggleWishlist('${p._id}', '${p.name}', ${p.price}, '${imgUrl}', this)"></i>
            </div>` : ''}
            
            ${isWishlistPage ? `<div style="padding: 0 14px 14px;">${actionBtn}</div>` : ''}
        </article>
    `;
}

async function toggleWishlist(id, name, price, image, iconElement = null) {
    const index = wishlist.findIndex(item => item.id === id);
    if(iconElement) iconElement.classList.toggle('active');

    if (currentUser) {
        try {
            const res = await fetch('/api/wishlist/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    product: { id, name, price, image }
                })
            });
            const dbWishlist = await res.json();
            
            wishlist = dbWishlist.map(item => ({
                id: item.product,
                name: item.name,
                price: item.price,
                image: item.image_url
            }));
            
            if (window.location.pathname.includes('wishlist.html')) renderWishlistPage();
        } catch (err) { console.error(err); }
    } else {
        if (index > -1) {
            wishlist.splice(index, 1);
        } else {
            wishlist.push({ id, name, price, image });
            alert(`Added ${name} to Wishlist! ❤️`);
        }
        localStorage.setItem('crazy_wishlist', JSON.stringify(wishlist));
        if (window.location.pathname.includes('wishlist.html')) renderWishlistPage();
    }
}

function renderWishlistPage() {
    const container = document.getElementById('wishlist-grid');
    const emptyMsg = document.getElementById('empty-wishlist-msg');
    
    if (container) {
        if (wishlist.length === 0) {
            container.innerHTML = '';
            if(emptyMsg) emptyMsg.style.display = 'block';
        } else {
            if(emptyMsg) emptyMsg.style.display = 'none';
            container.innerHTML = wishlist.map(item => {
                const p = { _id: item.id, name: item.name, price: item.price, image_url: item.image };
                return createProductCard(p, true);
            }).join('');
        }
    }
}

if (document.querySelector('#hero')) { 
    const slides = document.querySelectorAll('.slide');
    const dotsContainer = document.getElementById('carousel-dots');
    let index = 0;
    if(slides.length > 0 && dotsContainer) {
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'dot' + (i === 0 ? ' active' : '');
            dot.onclick = () => setActiveSlide(i);
            dotsContainer.appendChild(dot);
        });
        setInterval(() => setActiveSlide((index + 1) % slides.length), 5000);
    }
    function setActiveSlide(i) {
        index = i;
        slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
        document.querySelectorAll('.dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
    }

    loadHomeSection('new', 'new');
    loadHomeSection('featured', 'best');
    loadHomeSection('limited', 'limited');
}

async function loadHomeSection(apiType, sectionName) {
    const container = document.querySelector(`.products-grid[data-section="${sectionName}"]`);
    if (!container) return;
    const products = await fetchJSON(`/api/products?type=${apiType}`);
    renderGrid(container, products);
}

if (window.location.pathname.includes('product.html')) {
    const sections = [
        { id: 'blind-box', categoryName: 'Blind Box' },
        { id: 'figure', categoryName: 'Figure' },
        { id: 'standee', categoryName: 'Standee' },
        { id: 'card-pack', categoryName: 'Card Pack' },
        { id: 'other', categoryName: 'Other' }
    ];

    sections.forEach(sec => {
        const container = document.querySelector(`.products-grid[data-section="${sec.id}"]`);
        if (container) {
            fetchJSON(`/api/products?category=${encodeURIComponent(sec.categoryName)}`)
                .then(products => renderGrid(container, products));
        }
    });
}

if (window.location.pathname.includes('wishlist.html')) {
    renderWishlistPage();
}

if (window.location.pathname.includes('product-detail.html')) {
    const id = new URLSearchParams(window.location.search).get('id');
    const container = document.getElementById('product-detail-container');
    
    if (id && container) {
        fetchJSON(`/api/products/${id}`).then(product => {
            if(!product) return container.innerHTML = '<h2>Coming soon.</h2>';
            
            const isLiked = wishlist.some(i => i.id === product._id);
            const heartClass = isLiked ? 'active' : '';

            container.innerHTML = `
                <div class="product-detail-wrapper">
                    <div class="pd-image"><img src="${product.image_url}" style="width:100%; border-radius:10px;"></div>
                    <div class="pd-info">
                        <h1>${product.name}</h1>
                        <div class="pd-price">${formatPrice(product.price)}</div>
                        <p class="pd-desc">${product.description || ''}</p>
                        <p>Stock: ${product.stock}</p>
                        <br>
                        <div class="pd-actions">
                            <button class="btn-add-cart" id="add-btn">Add to Cart</button>
                            <button class="btn-wishlist" id="wishlist-btn"><i class="fa fa-heart ${heartClass}"></i></button>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('add-btn').addEventListener('click', () => {
                addToCart(product._id, product.name, product.price, product.image_url, product.stock);
            });

            document.getElementById('wishlist-btn').addEventListener('click', function() {
                const icon = this.querySelector('i');
                toggleWishlist(product._id, product.name, product.price, product.image_url, icon);
            });
        });
        
        const relatedContainer = document.getElementById('related-products');
        if (relatedContainer) {
            const userStr = localStorage.getItem('crazy_user');
            let currentUserId = null;
            if (userStr) {
                const userObj = JSON.parse(userStr);
                currentUserId = userObj.id || userObj._id;
            }

            const apiUrl = `/api/recommendations?currentProductId=${id}&userId=${currentUserId}`;
            
            fetchJSON(apiUrl).then(recommendedProducts => {
                renderGrid(relatedContainer, recommendedProducts);
            });
        }
    }
}

function renderGrid(container, products) {
    if (products && products.length > 0) {
        container.innerHTML = products.map(p => createProductCard(p)).join('');
    } else {
        container.innerHTML = '<p style="color:#aaa; padding:10px;">Coming soon.</p>';
    }
}

const cartOverlay = document.getElementById('cart-overlay');
const cartSidebar = document.getElementById('cart-sidebar');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart');

if(cartBtn) cartBtn.onclick = (e) => { e.preventDefault(); toggleCart(true); };
if(closeCartBtn) closeCartBtn.onclick = () => toggleCart(false);
if(cartOverlay) cartOverlay.onclick = () => toggleCart(false);

const checkoutBtn = document.querySelector('.checkout-btn');
if(checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        const user = JSON.parse(localStorage.getItem('crazy_user'));
        
        if(!user) {
            alert("Please login to checkout!");
            window.location.href = "login.html";
            return;
        } 
        
        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        const input = document.getElementById('redeem-input');
        const pointsUsed = input ? (parseInt(input.value) || 0) : 0;
        
        localStorage.setItem('crazy_checkout_points', pointsUsed);

        window.location.href = "checkout.html";
    });
}

function toggleCart(isOpen) {
    if(isOpen) { cartSidebar.classList.add('open'); cartOverlay.classList.add('open'); } 
    else { cartSidebar.classList.remove('open'); cartOverlay.classList.remove('open'); }
}

async function addToCart(id, name, price, img, stock = 999) {
    if (currentUser) {
        try {
            const res = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    product: { id, name, price, img }
                })
            });
            
            if (!res.ok) {
                const data = await res.json();
                alert(data.error);
                return;
            }

            const dbCart = await res.json();
            cart = dbCart.map(item => ({
                id: item.product,
                name: item.name,
                price: item.price,
                img: item.image_url,
                quantity: item.quantity,
                stock: item.stock
            }));
        } catch (err) { console.error("Add cart error", err); }
    } else {
        const existing = cart.find(i => i.id === id);
        if(existing) {
            if(existing.quantity >= stock) {
                alert(`Sorry, only ${stock} items available!`);
                return;
            }
            existing.quantity++;
        } else {
            cart.push({id, name, price, img, quantity:1, stock: stock});
        }
        localStorage.setItem('crazy_cart', JSON.stringify(cart));
    }
    
    updateCartUI();
    toggleCart(true);
}

window.removeCartItem = async function(index) {
    const itemToRemove = cart[index]; 
    
    cart.splice(index, 1);
    localStorage.setItem('crazy_cart', JSON.stringify(cart));
    updateCartUI();

    const user = JSON.parse(localStorage.getItem('crazy_user'));
    
    if (user && itemToRemove) {
        try {
            await fetch('/api/cart/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.id, 
                    productId: itemToRemove.id
                })
            });
            console.log("Sync remove successfully.");
        } catch (err) {
            console.error("Fail to remove.", err);
        }
    }
}

function updateCartUI() {
    const cartItemsEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');
    const badge = document.getElementById('cart-count');

    const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
    if(badge) {
        badge.textContent = totalQty;
        badge.style.display = totalQty > 0 ? 'block' : 'none';
    }

    if (!cartItemsEl || !totalEl) return;

    cartItemsEl.innerHTML = '';
    let subTotal = 0;

    cart.forEach((item, index) => {
        subTotal += item.price * item.quantity;
        cartItemsEl.innerHTML += `
            <div class="cart-item">
                <img src="${item.img}">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <div class="qty-control" style="display:flex; align-items:center; gap:10px; margin:5px 0;">
                        <button onclick="changeQty('${item.id}', -1)" style="width:25px; cursor:pointer;">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="changeQty('${item.id}', 1)" style="width:25px; cursor:pointer;">+</button>
                    </div>
                    <p>${formatPrice(item.price * item.quantity)}</p>
                </div>
                <div class="cart-remove" onclick="changeQty('${item.id}', -${item.quantity})" style="cursor:pointer; color:red;">
                    <i class="fa fa-trash"></i>
                </div>
            </div>`;
    });

    const userPoints = currentUser ? (currentUser.rewardPoints || 0) : 0;
    let discount = 0;

    const redeemInput = document.getElementById('redeem-input');
    let pointsUsed = redeemInput ? (parseInt(redeemInput.value) || 0) : 0;

    if (pointsUsed > userPoints) {
        pointsUsed = userPoints;
        if(redeemInput) redeemInput.value = pointsUsed;
    } else if (pointsUsed < 0) {
        pointsUsed = 0;
        if (redeemInput) redeemInput.value = pointsUsed;
    }
    
    const rate = 0.04;
    discount = pointsUsed * rate;

    const oldRedeem = document.querySelector('.points-redeem');
    if(oldRedeem) oldRedeem.remove(); 

    const pointsHTML = currentUser ? `
        <div class="points-redeem" style="margin-bottom:15px; border-top:1px solid #444; padding-top:10px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                <span>Available: <b style="color:gold">${userPoints} pts</b></span>
                <span>(1pt = ${currentCurrency === 'VND' ? '1,000đ' : '$0.04'})</span>
            </div>
            <div style="display:flex; gap:5px;">
                <input type="number" id="redeem-input" value="${pointsUsed > 0 ? pointsUsed : ''}" 
                       placeholder="Enter points" max="${userPoints}" oninput="updateCartUI()"
                       style="width:100%; padding:5px; background:#333; border:1px solid #555; color:white;">
            </div>
            ${pointsUsed > 0 ? `<div style="color:#2ecc71; text-align:right; margin-top:5px;">- ${formatPrice(discount)}</div>` : ''}
        </div>
    ` : '';

    const cartTotalDiv = document.querySelector('.cart-total');
    if(cartTotalDiv) cartTotalDiv.insertAdjacentHTML('beforebegin', pointsHTML);

    const finalTotal = Math.max(0, subTotal - discount);
    if(totalEl) totalEl.textContent = formatPrice(finalTotal);
    
    localStorage.setItem('crazy_checkout_points', pointsUsed);
}

async function changeQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    if (delta > 0 && item.stock !== undefined) {
        if (item.quantity >= item.stock) {
            alert(`Maximum stock reached! Only ${item.stock} available.`);
            return;
        }
    }

    const newQty = item.quantity + delta;

    if (newQty <= 0) {
        if(confirm("Remove this item?")) {
            cart = cart.filter(i => i.id !== productId);
            if(currentUser) await fetchRemoveItem(productId);
        } else {
            return;
        }
    } else {
        item.quantity = newQty;
        if(currentUser) await fetchUpdateQty(productId, newQty);
    }

    if (!currentUser) localStorage.setItem('crazy_cart', JSON.stringify(cart));
    updateCartUI();
}

async function fetchUpdateQty(productId, quantity) {
    try {
        const res = await fetch('/api/cart/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, productId, quantity })
        });
        if(!res.ok) {
            const data = await res.json();
            alert(data.error);
            const item = cart.find(i => i.id === productId);
            if(item) item.quantity -= 1; 
            updateCartUI();
        }
    } catch(e) { console.error(e); }
}

async function fetchRemoveItem(productId) {
    try {
        await fetch('/api/cart/remove', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, productId })
        });
    } catch(e) { console.error(e); }
}

updateCartUI();

document.querySelectorAll('.currency-option').forEach(btn => {
    btn.onclick = (e) => {
        e.preventDefault();
        const selectedCurrency = e.target.textContent;
        
        localStorage.setItem('crazy_currency', selectedCurrency);
        
        if(currencyDisplay) currencyDisplay.textContent = selectedCurrency;
        
        location.reload(); 
    }
});

window.addEventListener('storage', (e) => {
    if (e.key === 'crazy_cart') { cart = JSON.parse(e.newValue) || []; updateCartUI(); }
    if (e.key === 'crazy_wishlist') { wishlist = JSON.parse(e.newValue) || []; if(window.location.pathname.includes('wishlist.html')) renderWishlistPage(); }
});

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-user').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const errorMsg = document.getElementById('reg-error');

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            alert("Sign up successfully! Please login.");
            toggleForm();
        } else {
            errorMsg.textContent = data.error;
            errorMsg.style.display = 'block';
        }
    } catch (err) { console.error(err); }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('crazy_token', data.token);
            localStorage.setItem('crazy_user', JSON.stringify(data.user));

            await syncCartWithDB(data.user.id); 
            
            localStorage.removeItem('crazy_cart'); 
            localStorage.removeItem('crazy_wishlist');

            alert("Welcome back, " + data.user.username + "!");
            window.location.href = 'index.html';
        } else {
            if(errorMsg) {
                errorMsg.textContent = data.error;
                errorMsg.style.display = 'block';
            } else {
                alert(data.error);
            }
        }
    } catch (err) { console.error(err); }
}

async function checkLoginStatus() {
    const userLink = document.querySelector('.fa-user'); 
    
    let currentUser = JSON.parse(localStorage.getItem('crazy_user'));

    if (currentUser && userLink) {
        try {
            const res = await fetch(`/api/user/${currentUser.id}`);
            if(res.ok) {
                const userDB = await res.json();
                currentUser = { ...currentUser, ...userDB, id: userDB._id }; 
                localStorage.setItem('crazy_user', JSON.stringify(currentUser));
            }
        } catch(e) { 
            console.log("Sync error (ignore if offline):", e); 
        }

        const parentLi = userLink.parentElement;
        parentLi.classList.add('has-sub'); 
        
        const isAdmin = currentUser.role === 'admin';
        const adminLink = isAdmin ? `<li><a href="admin.html" style="color: #ff4757;">Admin Panel</a></li>` : '';

        const avatarSrc = currentUser.avatar ? currentUser.avatar : 'images/default-avatar.png';

        parentLi.innerHTML = `
            <a href="profile.html" class="user-profile-link" style="display:flex; align-items:center; gap:10px; text-decoration:none;">
                <img src="${avatarSrc}" 
                     style="width:35px; height:35px; border-radius:50%; border:2px solid #7c9cff; object-fit:cover;"
                     onerror="this.src='images/default-avatar.png'"> <span style="color: white; font-weight: bold;">${currentUser.username}</span>
                <i class="fa fa-caret-down" style="color:#f3f3f3"></i>
            </a>
            <ul class="sub-others">
                ${adminLink} 
                <li><a href="profile.html">My Profile</a></li>
                <li><a href="my-orders.html">My Orders</a></li>
                <li><a href="#" onclick="logout()">Logout</a></li>
            </ul>
        `;
    } else if (userLink) {
        userLink.parentElement.classList.remove('has-sub');
        userLink.href = "login.html";
        if(userLink.parentElement.querySelector('.sub-others')) {
             userLink.parentElement.innerHTML = '<a class="fa fa-user" href="login.html" aria-label="User"></a>';
        }
    }
}

window.logout = function() {
    localStorage.removeItem('crazy_token');
    localStorage.removeItem('crazy_user');
    alert("Logout successfully!");
    window.location.href = "index.html";
}

checkLoginStatus();

async function syncCartWithDB(userId) {
    const localCart = JSON.parse(localStorage.getItem('crazy_cart')) || [];
    if(localCart.length === 0) return; 

    try {
        await fetch('/api/cart/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, localCart: localCart })
        });
        console.log("Synced local items to database.");
    } catch (err) { console.error("Sync error", err); }
}

async function openGiftBox() {
    const boxImg = document.getElementById('gift-box-img');
    const msg = document.getElementById('gift-msg');
    
    const localUser = JSON.parse(localStorage.getItem('crazy_user'));
    if(!localUser) {
        alert("Please login to claim rewards!");
        return;
    }
    const realUserId = localUser.id || localUser._id;

    if (boxImg.style.opacity === '0.5') return;
    boxImg.style.opacity = '0.5';
    msg.innerText = "Checking...";
    msg.style.color = "white";

    try {
        const res = await fetch('/api/user/claim-reward', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: realUserId })
        });
        const data = await res.json();

        boxImg.style.opacity = '1';

        if(!res.ok) {
            msg.innerText = data.error;
            msg.style.color = "#ff4757";
            boxImg.src = "images/gift-closed.png"; 
            return;
        }

        boxImg.classList.add('shake');
        setTimeout(() => {
            boxImg.src = "images/gift-open.png";
            boxImg.classList.remove('shake');
            
            msg.innerHTML = `You received <b style="color:gold; font-size:24px;">${data.points}</b> points!<br><small style="color:#aaa">(${data.source})</small>`;
            msg.style.color = "#2ecc71";
            
            if(currentUser) currentUser.rewardPoints = data.totalPoints;
            localStorage.setItem('crazy_user', JSON.stringify(currentUser));
            updateCartUI(); 
        }, 1000);

    } catch (err) { 
        console.error(err); 
        boxImg.style.opacity = '1';
    }
}