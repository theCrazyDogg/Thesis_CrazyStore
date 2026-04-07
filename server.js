require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const Product = require("./src/models/Product");
const Category = require("./src/models/Category");
const Cart = require("./src/models/Cart");
const Wishlist = require("./src/models/Wishlist");
const Art = require("./src/models/Art");

const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/images';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const app = express();

app.use(cors());
app.use(express.json());

const publicPath = path.resolve(__dirname, "public");
app.use(express.static(publicPath));

console.log("Serving static files from:", publicPath);

app.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("DB Error:", err));

app.get("/api/products", async (req, res) => {
    try {
        const { type, category } = req.query;
        let filter = {};

        if (category) {
            const catObj = await Category.findOne({ name: new RegExp(category, 'i') });
            if (catObj) {
                filter.category = catObj._id;
            } else {
                return res.json([]);
            }
        }

        if (type === 'new') {
            const products = await Product.find(filter).sort({ createdAt: -1 }).limit(4);
            return res.json(products);
        }
        if (type === 'featured') {
            filter.is_featured = true;
        }
        if (type === 'limited') {
            filter.name = { $regex: 'Limited', $options: 'i' };
        }

        let query = Product.find(filter);
        if (type !== 'new' && type !== 'featured') {
        } else {
            query = query.limit(type === 'new' ? 4 : 8);
        }
        const products = await Product.find(filter);
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/api/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Not found" });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/cart/:userId", async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.params.userId });
        if (!cart) return res.json([]);

        const itemsWithStock = await Promise.all(cart.items.map(async (item) => {
            const product = await Product.findById(item.product);
            return {
                ...item.toObject(),
                stock: product ? product.stock : 0
            };
        }));
        
        res.json(itemsWithStock);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/cart/add", async (req, res) => {
    try {
        const { userId, product } = req.body;
        
        const dbProduct = await Product.findById(product.id);
        if (!dbProduct || dbProduct.stock <= 0) {
            return res.status(400).json({ error: "Sản phẩm đã hết hàng!" });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) cart = new Cart({ user: userId, items: [] });

        const existingItem = cart.items.find(item => item.product.toString() === product.id);
        if (existingItem) {
            if (existingItem.quantity + 1 > dbProduct.stock) {
                return res.status(400).json({ error: "Đã đạt giới hạn số lượng tồn kho!" });
            }
            existingItem.quantity += 1;
        } else {
            cart.items.push({
                product: product.id,
                name: product.name,
                price: product.price,
                image_url: product.img,
                quantity: 1
            });
        }
        
        cart.total_price = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        await cart.save();

        const newCartItems = await Promise.all(cart.items.map(async (item) => {
            const p = await Product.findById(item.product);
            return { ...item.toObject(), stock: p ? p.stock : 0 };
        }));

        res.json(newCartItems);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/cart/update", async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;
        
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ error: "Product not found" });

        if (quantity > product.stock) {
            return res.status(400).json({ error: `Chỉ còn ${product.stock} sản phẩm trong kho!` });
        }

        let cart = await Cart.findOne({ user: userId });
        if (cart) {
            const item = cart.items.find(i => i.product.toString() === productId);
            if (item) {
                item.quantity = quantity;
                cart.total_price = cart.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                await cart.save();
            }
        }
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/wishlist/:userId", async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ user: req.params.userId });
        res.json(wishlist ? wishlist.products : []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/wishlist/toggle", async (req, res) => {
    try {
        const { userId, product } = req.body;
        let wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) wishlist = new Wishlist({ user: userId, products: [] });

        const index = wishlist.products.findIndex(p => p.product.toString() === product.id);
        if (index > -1) {
            wishlist.products.splice(index, 1);
        } else {
            wishlist.products.push({
                product: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image
            });
        }
        await wishlist.save();
        res.json(wishlist.products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/cart/sync", async (req, res) => {
    try {
        const { userId, localCart } = req.body;

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        localCart.forEach(localItem => {
            const existingItem = cart.items.find(dbItem => 
                dbItem.product.toString() === localItem.id
            );

            if (existingItem) {
                existingItem.quantity += localItem.quantity;
            } else {
                cart.items.push({
                    product: localItem.id,
                    name: localItem.name,
                    price: localItem.price,
                    image_url: localItem.img,
                    quantity: localItem.quantity
                });
            }
        });

        cart.total_price = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        await cart.save();

        res.json({ message: "Cart synced", cart: cart.items });

    } catch (err) {
        console.error("Sync Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/cart/remove", async (req, res) => {
    try {
        const { userId, productId } = req.body;

        const cart = await Cart.findOne({ user: userId });
        if (cart) {
            cart.items = cart.items.filter(item => item.product.toString() !== productId);
            
            cart.total_price = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
            
            await cart.save();
            res.json({ message: "Item removed", cart: cart.items });
        } else {
            res.status(404).json({ error: "Cart not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require("./src/models/Order");

app.post("/api/create-payment-intent", async (req, res) => {
    try {
        const { userId, pointsUsed } = req.body;

        const cart = await Cart.findOne({ user: userId });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: "Cart is empty" });
        }

        let finalPrice = cart.total_price;

        if (pointsUsed > 0) {
            const user = await User.findById(userId);
            if (user && user.rewardPoints >= pointsUsed) {
                const discount = pointsUsed * 0.04;
                finalPrice = finalPrice - discount;
            }
        }

        if (finalPrice < 0) finalPrice = 0;

        const amount = Math.round(finalPrice * 100); 

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            metadata: { userId: userId.toString(), pointsUsed: pointsUsed.toString() }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/orders/finalize-stripe", async (req, res) => {
    try {
        const { paymentIntentId, userId, shippingInfo, pointsUsed } = req.body;

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            const userCart = await Cart.findOne({ user: userId });
            if(!userCart) return res.status(400).json({ error: "Cart not found" });

            for (const item of userCart.items) {
                await Product.findByIdAndUpdate(item.product, { 
                    $inc: { stock: -item.quantity } 
                });
            }

            let discountAmount = 0;
            if (pointsUsed > 0) {
                const user = await User.findById(userId);
                if (user && user.rewardPoints >= pointsUsed) {
                    user.rewardPoints -= pointsUsed;
                    user.pointHistory.push({
                        action: 'use',
                        amount: pointsUsed,
                        description: `Used for order via Stripe`,
                        date: new Date()
                    });
                    await user.save();
                    discountAmount = pointsUsed * 0.04;
                }
            }

            const finalTotal = Math.max(0, userCart.total_price - discountAmount);

            const newOrder = await Order.create({
                user: userId,
                full_name: shippingInfo.name,
                phone: shippingInfo.phone,
                address: shippingInfo.address,
                items: userCart.items,
                total_amount: finalTotal,
                payment_method: "Stripe",
                status: "Pending"
            });

            userCart.items = [];
            userCart.total_price = 0;
            await userCart.save();

            res.json({ success: true, orderId: newOrder._id });
        } else {
            res.status(400).json({ error: "Payment not successful" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to finalize order" });
    }
});

app.get("/api/my-orders/:userId", async (req, res) => {
    try {
        const orders = await Order.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/orders/:id/cancel", async (req, res) => {
    try {
        const { userId } = req.body;
        const order = await Order.findOne({ _id: req.params.id, user: userId });

        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.status !== 'Pending') {
            return res.status(400).json({ error: "Cannot cancel order unless it is Pending" });
        }

        order.status = 'Cancelled';
        
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
        
        await order.save();
        res.json({ message: "Order cancelled successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/products/:id", async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Product updated successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/art", async (req, res) => {
    try {
        const { type } = req.query;
        let filter = {};
        if (type) filter.type = type;
        const arts = await Art.find(filter).sort({ createdAt: -1 });
        res.json(arts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/art", async (req, res) => {
    try {
        const newArt = await Art.create(req.body);
        res.json(newArt);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/art/:id", async (req, res) => {
    try {
        await Art.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/art/:id", async (req, res) => {
    try {
        await Art.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/recommendations", async (req, res) => {
    try {
        const { userId, currentProductId } = req.query;
        let targetCategories = new Set();

        if (currentProductId && mongoose.Types.ObjectId.isValid(currentProductId)) {
            const currentProd = await Product.findById(currentProductId).select('category');
            if (currentProd && currentProd.category) {
                targetCategories.add(currentProd.category.toString());
            }
        }

        if (userId && userId !== 'null' && userId !== 'undefined') {
            
            const wishlist = await Wishlist.findOne({ user: userId });
            if (wishlist && wishlist.products.length > 0) {
                const wishProductIds = wishlist.products.map(p => p.product);
                const wishProducts = await Product.find({ _id: { $in: wishProductIds } }).select('category');
                wishProducts.forEach(p => { if (p.category) targetCategories.add(p.category.toString()); });
            }

            const orders = await Order.find({ user: userId });
            let orderProductIds = [];
            orders.forEach(o => {
                o.items.forEach(item => orderProductIds.push(item.product));
            });
            
            if (orderProductIds.length > 0) {
                const orderProducts = await Product.find({ _id: { $in: orderProductIds } }).select('category');
                orderProducts.forEach(p => { if (p.category) targetCategories.add(p.category.toString()); });
            }
        }

        let filter = {};
        if (currentProductId && mongoose.Types.ObjectId.isValid(currentProductId)) {
            filter._id = { $ne: currentProductId };
        }

        if (targetCategories.size > 0) {
            filter.category = { $in: Array.from(targetCategories) };
        } else {
            filter.is_featured = true; 
        }

        let recommendedProducts = await Product.find(filter).limit(4);

        if (recommendedProducts.length === 0) {
            recommendedProducts = await Product.find({ is_featured: true, _id: { $ne: currentProductId } }).limit(4);
        }

        res.json(recommendedProducts);

    } catch (err) {
        console.error("Recommendation Error:", err);
        res.status(500).json({ error: "Failed to load recommendations" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Try accessing: http://localhost:${PORT}/index.html`);
});

const crypto = require('crypto');
const axios = require('axios');

const configZaloPay = {
    app_id: "2553",
    key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
    key2: "kLtgPl8PIc22Rx2qrUboAaLa1fDdsQzP",
    endpoint: "https://sb-openapi.zalopay.vn/v2/create"
};

app.post("/api/orders/cod", async (req, res) => {
    try {
        const { userId, shippingInfo, pointsUsed } = req.body;
        
        const userCart = await Cart.findOne({ user: userId });
        if(!userCart || userCart.items.length === 0) {
            return res.status(400).json({ error: "Cart is empty" });
        }

        for (const item of userCart.items) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
        }

        let discountAmount = 0;
        if (pointsUsed > 0) {
            const user = await User.findById(userId);
            if (user && user.rewardPoints >= pointsUsed) {
                user.rewardPoints -= pointsUsed;
                user.pointHistory.push({ action: 'use', amount: pointsUsed, description: `Used for COD order`, date: new Date() });
                await user.save();
                discountAmount = pointsUsed * 0.04;
            }
        }

        const finalTotal = Math.max(0, userCart.total_price - discountAmount);

        const newOrder = await Order.create({
            user: userId, 
            full_name: shippingInfo.name, 
            phone: shippingInfo.phone, 
            address: shippingInfo.address,
            items: userCart.items, 
            total_amount: finalTotal, 
            payment_method: "COD", 
            status: "Pending"
        });

        userCart.items = []; 
        userCart.total_price = 0;
        await userCart.save();

        res.json({ success: true, orderId: newOrder._id });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "COD Error" }); 
    }
});

app.post("/api/payment/zalopay", async (req, res) => {
    try {
        const { userId, shippingInfo, pointsUsed } = req.body;

        const userCart = await Cart.findOne({ user: userId });
        if(!userCart || userCart.items.length === 0) return res.status(400).json({ error: "Cart is empty" });

        let discountAmountUSD = 0;
        if (pointsUsed > 0) {
            const user = await User.findById(userId);
            if (user && user.rewardPoints >= pointsUsed) {
                discountAmountUSD = pointsUsed * 0.04;
            }
        }

        const finalTotalUSD = Math.max(0, userCart.total_price - discountAmountUSD);
        const finalTotalVND = Math.round(finalTotalUSD * 25000); 

        const newOrder = await Order.create({
            user: userId, 
            full_name: shippingInfo.name, 
            phone: shippingInfo.phone, 
            address: shippingInfo.address,
            items: userCart.items, 
            total_amount: finalTotalUSD, 
            payment_method: "ZaloPay", 
            status: "Pending Payment"
        });

        const redirectUrl = `http://localhost:3000/api/payment/zalopay-return?orderId=${newOrder._id}&userId=${userId}&pointsUsed=${pointsUsed}`;

        const embed_data = { redirecturl: redirectUrl }; 
        const items = [{}]; 
        const transID = Math.floor(Math.random() * 1000000);
        const yymmdd = String(new Date().getFullYear()).slice(-2) + String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0');
        const app_trans_id = `${yymmdd}_${transID}`;

        const orderParams = {
            app_id: configZaloPay.app_id, 
            app_trans_id: app_trans_id, 
            app_user: userId.toString(), 
            app_time: Date.now(),
            item: JSON.stringify(items), 
            embed_data: JSON.stringify(embed_data),
            amount: finalTotalVND > 0 ? finalTotalVND : 1000, 
            description: `CrazyStore - Thanh toán ZaloPay #${newOrder._id.toString().slice(-6)}`,
            bank_code: "",
        };

        const dataForMac = configZaloPay.app_id + "|" + orderParams.app_trans_id + "|" + orderParams.app_user + "|" + orderParams.amount + "|" + orderParams.app_time + "|" + orderParams.embed_data + "|" + orderParams.item;
        orderParams.mac = crypto.createHmac('sha256', configZaloPay.key1).update(dataForMac).digest('hex');

        const payload = new URLSearchParams(orderParams).toString();
        
        const response = await axios.post(configZaloPay.endpoint, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.return_code === 1) {
            res.json({ success: true, order_url: response.data.order_url });
        } else {
            res.status(400).json({ error: "Lỗi tạo ZaloPay QR: " + response.data.return_message });
        }
    } catch (err) { 
        console.error("Chi tiết lỗi ZaloPay:", err.response ? err.response.data : err.message);
        res.status(500).json({ error: "ZaloPay API Error" }); 
    }
});

app.get("/api/payment/zalopay-return", async (req, res) => {
    try {
        const { status, orderId, userId, pointsUsed } = req.query;

        if (status === "1") {
            const order = await Order.findById(orderId);
            
            if (order && order.status === "Pending Payment") {
                order.status = "Pending";
                await order.save();

                for (const item of order.items) {
                    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
                }

                await Cart.findOneAndUpdate({ user: userId }, { items: [], total_price: 0 });

                const pUsed = parseInt(pointsUsed) || 0;
                if (pUsed > 0) {
                    const user = await User.findById(userId);
                    if (user && user.rewardPoints >= pUsed) {
                        user.rewardPoints -= pUsed;
                        user.pointHistory.push({ action: 'use', amount: pUsed, description: `Used for ZaloPay order`, date: new Date() });
                        await user.save();
                    }
                }
            }
            res.redirect("/my-orders.html");

        } else {
            await Order.findByIdAndDelete(orderId);
            
            res.redirect("/checkout.html?error=zalopay_cancelled");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/checkout.html?error=server_error");
    }
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./src/models/User');

app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Email already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword
        });

        res.json({ message: "User created successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ error: 'Email không tồn tại!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Sai mật khẩu!' });
        }

        res.json({
            token: 'fake-jwt-token',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                rewardPoints: user.rewardPoints,
                extraSpins: user.extraSpins
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/admin/orders", async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'email username').sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/admin/orders/:id", async (req, res) => {
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/stats", async (req, res) => {
    try {
        const days = req.query.days || '7';
        let dateFilter = {};

        if (days !== 'all') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            dateFilter = { createdAt: { $gte: cutoffDate } };
        }

        const orders = await Order.find(dateFilter).sort({ createdAt: 1 });

        let totalRevenue = 0;
        let pendingRevenue = 0;
        const totalOrders = orders.length;

        const chartDataMap = {};

        if (days !== 'all') {
            for (let i = parseInt(days) - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateString = d.toISOString().split('T')[0];
                chartDataMap[dateString] = { total: 0, pending: 0 };
            }
        }

        orders.forEach(order => {
            const amount = order.total_amount || 0;
            const dateObj = order.createdAt ? new Date(order.createdAt) : new Date();
            const dateString = dateObj.toISOString().split('T')[0];

            if (!chartDataMap[dateString]) {
                chartDataMap[dateString] = { total: 0, pending: 0 };
            }

            if (order.status === 'Delivered') {
                totalRevenue += amount;
                chartDataMap[dateString].total += amount;
            } else if (order.status === 'Pending' || order.status === 'Shipped' || order.status === 'Pending Payment') {
                pendingRevenue += amount;
                chartDataMap[dateString].pending += amount;
            }
        });

        const labels = Object.keys(chartDataMap).sort();
        const totalData = labels.map(l => chartDataMap[l].total);
        const pendingData = labels.map(l => chartDataMap[l].pending);

        res.json({ 
            summary: { totalRevenue, pendingRevenue, totalOrders },
            chart: { labels, totalData, pendingData }
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.post("/api/products", async (req, res) => {
    try {
        const newProduct = await Product.create(req.body);
        res.json(newProduct);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/products/:id", async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/products/:id", async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/upload", upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const imageUrl = `images/${req.file.filename}`;
        res.json({ imageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/categories", async (req, res) => {
    try {
        const { name } = req.body;
        const newCat = await Category.create({ name });
        res.json(newCat);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/categories/:id", async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: "Category deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/user/basic/:id", upload.single('avatar'), async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findById(req.params.id);
        
        if (username && username !== user.username) {
            const exists = await User.findOne({ username });
            if (exists) return res.status(400).json({ error: "Username already taken" });
            user.username = username;
        }

        if (req.file) {
            user.avatar = `images/${req.file.filename}`;
        }

        await user.save();
        res.json({ message: "Profile updated", user: { ...user._doc, password: "" } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/user/verify-password", async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId) {
            return res.json({ valid: false, error: "Missing User ID" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.json({ valid: false, error: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            res.json({ valid: true });
        } else {
            res.json({ valid: false });
        }

    } catch (err) {
        console.error("Lỗi Server:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/user/security/:id", async (req, res) => {
    try {
        const { email, password } = req.body;
        const updateData = {};
        
        if(email) updateData.email = email;
        
        if(password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }
        
        await User.findByIdAndUpdate(req.params.id, updateData);
        res.json({ message: "Security settings updated" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.post("/api/user/claim-reward", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing User ID" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const lastReward = user.lastDailyReward ? new Date(user.lastDailyReward) : new Date(0);

        let canClaim = false;
        let source = "";

        if (lastReward < startOfToday) {
            canClaim = true;
            user.lastDailyReward = new Date();
            source = "Daily Gift";
        } 
        else if (user.extraSpins > 0) {
            canClaim = true;
            user.extraSpins -= 1;
            source = "Bonus Turn (Order Delivered)";
        }

        if (!canClaim) {
            return res.status(400).json({ error: "Please comeback tomorrow!" });
        }

        const rand = Math.random() * 100;
        let points = 0;
        if (rand < 0.1) points = 10;       // 0.1%
        else if (rand < 0.3) points = 5;   // 0.2%
        else if (rand < 20.3) points = 2;  // 20%
        else points = 1;                   // 79.7%

        user.rewardPoints += points;
        user.pointHistory.push({
            action: 'gain',
            amount: points,
            description: `Opened Gift Box (${source})`,
            date: new Date()
        });
        
        await user.save();
        
        res.json({ points, totalPoints: user.rewardPoints, source });

    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

app.put("/api/orders/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) return res.status(404).json({ error: "Order not found" });

        if (status === 'Delivered' && order.status !== 'Delivered') {
            await User.findByIdAndUpdate(order.user_id, { $inc: { extraSpins: 1 } });
            console.log(`User ${order.user_id} received 1 bonus spin!`);
        }
        
        order.status = status;
        await order.save();
        res.json({ message: "Order status updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: "Invalid User ID format" });
        }

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            rewardPoints: user.rewardPoints,
            pointHistory: user.pointHistory,
            extraSpins: user.extraSpins
        });

    } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ error: err.message });
    }
});