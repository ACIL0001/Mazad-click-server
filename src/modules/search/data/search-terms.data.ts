/**
 * Common search terms from popular e-commerce websites
 * Includes products, categories, and brands from Amazon, eBay, AliExpress, etc.
 */

export const commonSearchTerms = [
    // Electronics - Smartphones
    { term: "iPhone 15 Pro", type: "product", metadata: { brand: "Apple", category: "Smartphones" } },
    { term: "iPhone 15", type: "product", metadata: { brand: "Apple", category: "Smartphones" } },
    { term: "iPhone 14", type: "product", metadata: { brand: "Apple", category: "Smartphones" } },
    { term: "Samsung Galaxy S24", type: "product", metadata: { brand: "Samsung", category: "Smartphones" } },
    { term: "Samsung Galaxy S23", type: "product", metadata: { brand: "Samsung", category: "Smartphones" } },
    { term: "Google Pixel 8", type: "product", metadata: { brand: "Google", category: "Smartphones" } },
    { term: "Xiaomi Redmi Note", type: "product", metadata: { brand: "Xiaomi", category: "Smartphones" } },
    { term: "OnePlus", type: "product", metadata: { brand: "OnePlus", category: "Smartphones" } },

    // Electronics - Laptops
    { term: "MacBook Pro", type: "product", metadata: { brand: "Apple", category: "Laptops" } },
    { term: "MacBook Air", type: "product", metadata: { brand: "Apple", category: "Laptops" } },
    { term: "Dell XPS 15", type: "product", metadata: { brand: "Dell", category: "Laptops" } },
    { term: "Dell XPS 13", type: "product", metadata: { brand: "Dell", category: "Laptops" } },
    { term: "HP Pavilion", type: "product", metadata: { brand: "HP", category: "Laptops" } },
    { term: "Lenovo ThinkPad", type: "product", metadata: { brand: "Lenovo", category: "Laptops" } },
    { term: "ASUS ROG", type: "product", metadata: { brand: "ASUS", category: "Laptops" } },
    { term: "Acer Aspire", type: "product", metadata: { brand: "Acer", category: "Laptops" } },

    // Electronics - Gaming
    { term: "PlayStation 5", type: "product", metadata: { brand: "Sony", category: "Gaming Consoles", aliases: ["PS5", "PlayStation V"] } },
    { term: "Xbox Series X", type: "product", metadata: { brand: "Microsoft", category: "Gaming Consoles" } },
    { term: "Nintendo Switch", type: "product", metadata: { brand: "Nintendo", category: "Gaming Consoles" } },
    { term: "Steam Deck", type: "product", metadata: { brand: "Valve", category: "Gaming Consoles" } },
    { term: "RTX 4090", type: "product", metadata: { brand: "NVIDIA", category: "Graphics Cards" } },
    { term: "RTX 4080", type: "product", metadata: { brand: "NVIDIA", category: "Graphics Cards" } },
    { term: "GTX 3060", type: "product", metadata: { brand: "NVIDIA", category: "Graphics Cards", aliases: ["GeForce GTX 3060"] } },

    // Electronics - Audio
    { term: "AirPods Pro", type: "product", metadata: { brand: "Apple", category: "Headphones" } },
    { term: "Sony WH-1000XM5", type: "product", metadata: { brand: "Sony", category: "Headphones" } },
    { term: "Bose QuietComfort", type: "product", metadata: { brand: "Bose", category: "Headphones" } },
    { term: "JBL Flip", type: "product", metadata: { brand: "JBL", category: "Speakers" } },

    // Electronics - TVs
    { term: "LG OLED TV", type: "product", metadata: { brand: "LG", category: "TVs" } },
    { term: "Samsung QLED", type: "product", metadata: { brand: "Samsung", category: "TVs" } },
    { term: "Sony Bravia", type: "product", metadata: { brand: "Sony", category: "TVs" } },

    // Fashion - Shoes
    { term: "Nike Air Max", type: "product", metadata: { brand: "Nike", category: "Shoes" } },
    { term: "Nike Air Jordan", type: "product", metadata: { brand: "Nike", category: "Shoes" } },
    { term: "Adidas Ultraboost", type: "product", metadata: { brand: "Adidas", category: "Shoes" } },
    { term: "Adidas Yeezy", type: "product", metadata: { brand: "Adidas", category: "Shoes" } },
    { term: "Converse Chuck Taylor", type: "product", metadata: { brand: "Converse", category: "Shoes" } },
    { term: "Vans Old Skool", type: "product", metadata: { brand: "Vans", category: "Shoes" } },
    { term: "New Balance 574", type: "product", metadata: { brand: "New Balance", category: "Shoes" } },

    // Fashion - Clothing
    { term: "Levi's Jeans", type: "product", metadata: { brand: "Levi's", category: "Clothing" } },
    { term: "North Face Jacket", type: "product", metadata: { brand: "The North Face", category: "Clothing" } },
    { term: "Patagonia Fleece", type: "product", metadata: { brand: "Patagonia", category: "Clothing" } },
    { term: "Tommy Hilfiger", type: "product", metadata: { brand: "Tommy Hilfiger", category: "Clothing" } },

    // Fashion - Accessories
    { term: "Ray-Ban Sunglasses", type: "product", metadata: { brand: "Ray-Ban", category: "Accessories" } },
    { term: "Oakley Sunglasses", type: "product", metadata: { brand: "Oakley", category: "Accessories" } },
    { term: "Fossil Watch", type: "product", metadata: { brand: "Fossil", category: "Watches" } },
    { term: "Casio Watch", type: "product", metadata: { brand: "Casio", category: "Watches" } },

    // Home & Kitchen - Appliances
    { term: "Dyson Vacuum", type: "product", metadata: { brand: "Dyson", category: "Appliances" } },
    { term: "KitchenAid Mixer", type: "product", metadata: { brand: "KitchenAid", category: "Appliances" } },
    { term: "Instant Pot", type: "product", metadata: { brand: "Instant Pot", category: "Appliances" } },
    { term: "Ninja Blender", type: "product", metadata: { brand: "Ninja", category: "Appliances" } },
    { term: "Vitamix Blender", type: "product", metadata: { brand: "Vitamix", category: "Appliances" } },

    // Home & Kitchen - Furniture
    { term: "IKEA Desk", type: "product", metadata: { brand: "IKEA", category: "Furniture" } },
    { term: "IKEA Chair", type: "product", metadata: { brand: "IKEA", category: "Furniture" } },
    { term: "IKEA Bookshelf", type: "product", metadata: { brand: "IKEA", category: "Furniture" } },

    // Sports & Outdoors
    { term: "Peloton Bike", type: "product", metadata: { brand: "Peloton", category: "Exercise Equipment" } },
    { term: "Theragun Massager", type: "product", metadata: { brand: "Theragun", category: "Sports" } },
    { term: "Yeti Cooler", type: "product", metadata: { brand: "Yeti", category: "Outdoor" } },

    // Categories
    { term: "Electronics", type: "category", metadata: { category: "Electronics" } },
    { term: "Smartphones", type: "category", metadata: { category: "Electronics" } },
    { term: "Laptops", type: "category", metadata: { category: "Electronics" } },
    { term: "Gaming", type: "category", metadata: { category: "Electronics" } },
    { term: "Headphones", type: "category", metadata: { category: "Electronics" } },
    { term: "TVs", type: "category", metadata: { category: "Electronics" } },
    { term: "Fashion", type: "category", metadata: { category: "Fashion" } },
    { term: "Shoes", type: "category", metadata: { category: "Fashion" } },
    { term: "Clothing", type: "category", metadata: { category: "Fashion" } },
    { term: "Accessories", type: "category", metadata: { category: "Fashion" } },
    { term: "Home & Kitchen", type: "category", metadata: { category: "Home" } },
    { term: "Appliances", type: "category", metadata: { category: "Home" } },
    { term: "Furniture", type: "category", metadata: { category: "Home" } },
    { term: "Sports", type: "category", metadata: { category: "Sports" } },
    { term: "Outdoor", type: "category", metadata: { category: "Sports" } },
    { term: "Books", type: "category", metadata: { category: "Media" } },
    { term: "Toys", type: "category", metadata: { category: "Toys" } },
    { term: "Baby", type: "category", metadata: { category: "Baby" } },
    { term: "Automotive", type: "category", metadata: { category: "Automotive" } },
    { term: "Health & Beauty", type: "category", metadata: { category: "Health" } },

    // Arabic products (for multilingual support)
    { term: "بطاطا حمراء", type: "product", metadata: { category: "Food", aliases: ["بطاطا", "بطاطس حمراء"] } },
    { term: "هاتف", type: "category", metadata: { category: "Electronics", aliases: ["هواتف", "جوال"] } },
    { term: "حاسوب", type: "category", metadata: { category: "Electronics", aliases: ["كمبيوتر", "لابتوب"] } },
    { term: "ملابس", type: "category", metadata: { category: "Fashion", aliases: ["لباس", "ثياب"] } },
    { term: "أحذية", type: "category", metadata: { category: "Fashion", aliases: ["حذاء", "جزم"] } },
    { term: "أثاث", type: "category", metadata: { category: "Furniture", aliases: ["اثاث منزلي"] } },
    { term: "إلكترونيات", type: "category", metadata: { category: "Electronics" } },

    // Services
    { term: "Web Design", type: "service", metadata: { category: "Services" } },
    { term: "Graphic Design", type: "service", metadata: { category: "Services" } },
    { term: "Photography", type: "service", metadata: { category: "Services" } },
    { term: "Plumbing", type: "service", metadata: { category: "Services" } },
    { term: "Electrical", type: "service", metadata: { category: "Services" } },
    { term: "Cleaning", type: "service", metadata: { category: "Services" } },
    { term: "Moving", type: "service", metadata: { category: "Services" } },
    { term: "Painting", type: "service", metadata: { category: "Services" } },
    { term: "Carpentry", type: "service", metadata: { category: "Services" } },
];
