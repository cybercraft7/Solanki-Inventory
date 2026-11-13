/*
 * DataService - the "backend bridge".
 * Phase 1: localStorage. Phase 2: replace bodies with fetch() to your API.
 * Every function is async so app.js never has to change.
 * Field names mirror the future MySQL tables.
 */
const DataService = (() => {
  const KEYS = {
    categories: 'categories',
    suppliers: 'suppliers',
    products: 'products',
    orders: 'orders',
    users: 'users',
    session: 'session'
  };

  const daysFromNow = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
  };

  const SEED = {
    categories: [
      { id: 1, category_name: 'Ice Cream Tubs', description: 'Bulk ice cream sold by the scoop' },
      { id: 2, category_name: 'Toppings', description: 'Sprinkles, syrups, nuts' },
      { id: 3, category_name: 'Cones & Cups', description: 'Serving items' }
    ],
    suppliers: [
      { id: 1, supplier_name: 'Frosty Dairy Co.', phone: '9876500001', email: 'orders@frostydairy.example' },
      { id: 2, supplier_name: 'Sweet Toppings Ltd.', phone: '9876500002', email: 'sales@sweettoppings.example' }
    ],
    products: [
      { id: 1, name: 'Vanilla', category_id: 1, supplier_id: 1, stock_tubs: 6, min_stock_alert: 2, expiry_date: daysFromNow(30), price: 40 },
      { id: 2, name: 'Chocolate', category_id: 1, supplier_id: 1, stock_tubs: 2, min_stock_alert: 3, expiry_date: daysFromNow(5), price: 45 },
      { id: 3, name: 'Strawberry', category_id: 1, supplier_id: 1, stock_tubs: 0, min_stock_alert: 2, expiry_date: daysFromNow(20), price: 45 },
      { id: 4, name: 'Choco Sprinkles', category_id: 2, supplier_id: 2, stock_tubs: 10, min_stock_alert: 3, expiry_date: daysFromNow(90), price: 10 },
      { id: 5, name: 'Waffle Cone', category_id: 3, supplier_id: 2, stock_tubs: 40, min_stock_alert: 15, expiry_date: daysFromNow(60), price: 15 }
    ],
    orders: [],
    users: [
      { id: 1, name: 'Owner', email: 'owner@parlour.example', role: 'Admin' },
      { id: 2, name: 'Counter', email: 'counter@parlour.example', role: 'Staff' }
    ]
  };

  const read = (key) => JSON.parse(localStorage.getItem(key) || 'null');
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const nextId = (arr) => (arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1);

  // Seed once
  ['categories', 'suppliers', 'products', 'orders', 'users'].forEach(k => {
    if (read(KEYS[k]) === null) write(KEYS[k], SEED[k]);
  });

  // Generic helpers
  const list = async (key) => read(KEYS[key]) || [];
  const add = async (key, obj) => {
    const arr = read(KEYS[key]) || [];
    const item = { ...obj, id: nextId(arr) };
    arr.push(item);
    write(KEYS[key], arr);
    return item;
  };
  const update = async (key, id, changes) => {
    const arr = read(KEYS[key]) || [];
    const i = arr.findIndex(x => x.id === id);
    if (i === -1) return null;
    arr[i] = { ...arr[i], ...changes };
    write(KEYS[key], arr);
    return arr[i];
  };
  const remove = async (key, id) => {
    write(KEYS[key], (read(KEYS[key]) || []).filter(x => x.id !== id));
  };

  return {
    // Session
    login: async (user) => write(KEYS.session, user),
    logout: async () => localStorage.removeItem(KEYS.session),
    getSession: async () => read(KEYS.session),

    // Products
    getProducts: () => list('products'),
    addProduct: (p) => add('products', p),
    updateProduct: (id, c) => update('products', id, c),
    deleteProduct: (id) => remove('products', id),

    // Categories
    getCategories: () => list('categories'),
    addCategory: (c) => add('categories', c),
    deleteCategory: (id) => remove('categories', id),

    // Suppliers
    getSuppliers: () => list('suppliers'),
    addSupplier: (s) => add('suppliers', s),
    deleteSupplier: (id) => remove('suppliers', id),

    // Users
    getUsers: () => list('users'),

    // Orders
    getOrders: () => list('orders'),
    addOrder: (o) => add('orders', o),

    // Dev helper: reset all data
    resetAll: async () => {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  };
})();
