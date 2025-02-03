'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');

// Данные для засеивания
const { categories, products, users } = require('../data/seed-data.json');

async function seedStore() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      console.log('⏳ Начинаем засеивание данных...');
      await importSeedData();
      console.log('✅ Засеивание завершено!');
    } catch (error) {
      console.log('❌ Ошибка засеивания данных');
      console.error(error);
    }
  } else {
    console.log('⚠️ Данные уже были импортированы ранее.');
  }
}

// Проверка, запускался ли seed ранее
async function isFirstRun() {
  const pluginStore = strapi.store({ type: 'type', name: 'setup' });
  const initHasRun = await pluginStore.get({ key: 'initHasRun' });
  await pluginStore.set({ key: 'initHasRun', value: true });
  return !initHasRun;
}

// Создание записи в БД
async function createEntry(model, data) {
  try {
    return await strapi.entityService.create(`api::${model}.${model}`, { data });
  } catch (error) {
    console.error(`❌ Ошибка при создании ${model}:`, error);
  }
}

// Импорт пользователей (админ и клиенты)
async function importUsers() {
  for (const user of users) {
    await createEntry('user', {
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role,
      phone: user.phone,
      address: user.address,
    });
  }
}

// Импорт категорий
async function importCategories() {
  for (const category of categories) {
    await createEntry('category', { name: category.name, slug: category.slug });
  }
}

// Импорт товаров
async function importProducts() {
  for (const product of products) {
    const images = await uploadImages(product.images);
    await createEntry('product', {
      title: product.title,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      images: images,
    });
  }
}

// Импорт тестовых заказов
async function importOrders() {
  const testOrder = {
    user: 1, // ID пользователя
    products: [
      { product: 1, quantity: 2, price: 199.99 },
      { product: 3, quantity: 1, price: 49.99 },
    ],
    totalPrice: 449.97,
    status: 'pending',
  };
  await createEntry('order', testOrder);
}

// Загрузка изображений
async function uploadImages(imageNames) {
  const uploadedImages = [];
  for (const imageName of imageNames) {
    const filePath = path.join('data/uploads', imageName);
    if (fs.existsSync(filePath)) {
      const fileData = {
        path: filePath,
        name: imageName,
        type: mime.lookup(imageName),
      };
      const uploaded = await strapi.plugins['upload'].services.upload.upload({ files: fileData });
      uploadedImages.push(uploaded[0]);
    }
  }
  return uploadedImages;
}

// Импорт всех данных
async function importSeedData() {
  await importUsers();
  await importCategories();
  await importProducts();
  await importOrders();
}

// Запуск скрипта
async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedStore();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
