require('dotenv').config();
const mongoose = require("mongoose");
const Category = require("./src/models/Category");
const Product = require("./src/models/Product");

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    await Category.deleteMany({});
    await Product.deleteMany({});

    const catBlindBox = await Category.create({ name: "Blind Box", description: "Mystery boxes" });
    const catFigure = await Category.create({ name: "Figure", description: "Honkai figures" });
    const catStandee = await Category.create({ name: "Standee", description: "Acrylic stands" });
    const catCardPack = await Category.create({ name: "Card Pack", description: "Collection packs" });
    const catOther = await Category.create({ name: "Other", description: "Accessories & more" });

    console.log("Categories created.");

    const products = [
      {
        name: "Chibi Figure",
        price: 49.99,
        category: catFigure._id,
        image_url: "images/product1.jpg",
        stock: 40,
        is_featured: false
      },

      {
        name: "Star Rail Boys - Chibi Blind Box",
        price: 15.99,
        category: catBlindBox._id,
        image_url: "images/product2.jpeg",
        stock: 50,
        is_featured: true
      },

      {
        name: "Poster Pack",
        price: 12.99,
        category: catCardPack._id,
        image_url: "images/product3.jpg",
        stock: 50,
        is_featured: false
      },

      {
        name: "Keychain",
        price: 9.99,
        category: catOther._id,
        image_url: "images/product4.jpg",
        stock: 50,
        is_featured: false
      },

      {
        name: "Fu Xuan Figure Standard",
        price: 89.99,
        category: catFigure._id,
        image_url: "images/product5.jpeg",
        stock: 20,
        is_featured: true
      },

      {
        name: "Chimera Blind Box",
        price: 12.50,
        category: catBlindBox._id,
        image_url: "images/product6.jpeg",
        stock: 100,
        is_featured: false
      },
      
      {
        name: "Silver Wolf Standee",
        price: 18.00,
        category: catStandee._id,
        image_url: "images/product7.jpeg",
        stock: 40,
        is_featured: true
      },

      {
        name: "Pom-Pom Chibi Plush",
        price: 49.99,
        category: catOther._id,
        image_url: "images/product8.jpg",
        stock: 40,
        is_featured: false
      },

      {
        name: "Limited Edition Dan Heng - Imbibitor Lunae Figure",
        price: 199.99,
        category: catFigure._id,
        image_url: "images/product9.jpeg",
        stock: 5,
        is_featured: true
      },

      {
        name: "Card Pack",
        price: 12.99,
        category: catCardPack._id,
        image_url: "images/product10.jpg",
        stock: 5,
        is_featured: false
      },

      {
        name: "Limited Blind Box",
        price: 49.99,
        category: catBlindBox._id,
        image_url: "images/product11.jpg",
        stock: 5,
        is_featured: false
      },
      
      {
        name: "Splash Art Limited Standee",
        price: 25.00,
        category: catStandee._id,
        image_url: "images/product12.jpg",
        stock: 30,
        is_featured: false
      },
    ];

    await Product.insertMany(products);
    console.log("Database seeded successfully!");

    mongoose.disconnect();
  } catch (err) {
    console.error("Error seeding:", err);
  }
}

seedDatabase();