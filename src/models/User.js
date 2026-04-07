const mongoose = require('mongoose');

// Schema lưu lịch sử điểm
const pointHistorySchema = new mongoose.Schema({
    action: { type: String, enum: ['gain', 'use'], required: true }, // 'gain' (nhận) hoặc 'use' (dùng)
    amount: { type: Number, required: true },
    description: String,
    date: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    
    // --- CÁC TRƯỜNG MỚI ---
    avatar: { type: String, default: 'images/default-avatar.png' },
    rewardPoints: { type: Number, default: 0 },
    pointHistory: [pointHistorySchema],
    
    // Logic Hộp quà
    lastDailyReward: { type: Date, default: null }, // Ngày nhận quà hàng ngày gần nhất
    extraSpins: { type: Number, default: 0 },       // Lượt mở thêm (từ đơn hàng)
    // ----------------------
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);