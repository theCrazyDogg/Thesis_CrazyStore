require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function migratePasswords() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully. Starting checking user...");

        const users = await User.find({});
        let count = 0;

        for (let user of users) {
            const isAlreadyHashed = user.password.startsWith('$2') && user.password.length === 60;

            if (!isAlreadyHashed) {
                console.log("Encrypting password for user: ${user.email}");
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(user.password, salt);
                
                user.password = hashedPassword;
                await user.save();
                count++;
            }
        }

        console.log("Successfully! Passwords have been encrypted for ${count} users.");
    } catch (error) {
        console.error("Error:", error);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
}

migratePasswords();