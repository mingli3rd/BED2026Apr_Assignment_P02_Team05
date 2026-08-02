const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "data", "stall-profile-settings.json");
const ALLOWED_LAYOUT_MODES = ["list", "grid", "spotlight"];

function toUniqueIntArray(value, allowedIds = null) {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((entry) => parseInt(entry, 10))
    .filter((entry) => Number.isInteger(entry));

  const unique = Array.from(new Set(parsed));
  if (!allowedIds) return unique;

  const allowedSet = new Set(allowedIds);
  return unique.filter((id) => allowedSet.has(id));
}

function normalizeSettings(rawSettings = {}, allowedItemIds = []) {
  const allowedIds = Array.isArray(allowedItemIds) ? allowedItemIds : [];
  const layout_mode = ALLOWED_LAYOUT_MODES.includes(rawSettings.layout_mode) ? rawSettings.layout_mode : "list";

  return {
    layout_mode,
    recommended_item_ids: toUniqueIntArray(rawSettings.recommended_item_ids, allowedIds),
    best_seller_item_ids: toUniqueIntArray(rawSettings.best_seller_item_ids, allowedIds),
    item_order: toUniqueIntArray(rawSettings.item_order, allowedIds),
  };
}

function applySettingsToMenu(menuItems, settings) {
  const recommendedSet = new Set(settings.recommended_item_ids || []);
  const bestSellerSet = new Set(settings.best_seller_item_ids || []);
  const orderMap = new Map((settings.item_order || []).map((id, index) => [id, index]));

  return [...menuItems]
    .map((item) => ({
      ...item,
      is_recommended: recommendedSet.has(item.id),
      is_best_seller: bestSellerSet.has(item.id),
    }))
    .sort((a, b) => {
      const aOrder = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;

      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return a.id - b.id;
    });
}

async function readAllSettings() {
  try {
    const raw = await fs.promises.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeAllSettings(allSettings) {
  const dir = path.dirname(SETTINGS_FILE);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), "utf8");
}

async function getVendorSettings(vendorId, allowedItemIds = []) {
  const allSettings = await readAllSettings();
  const key = String(vendorId);
  return normalizeSettings(allSettings[key], allowedItemIds);
}

async function saveVendorSettings(vendorId, settings, allowedItemIds = []) {
  const allSettings = await readAllSettings();
  const key = String(vendorId);
  const normalized = normalizeSettings(settings, allowedItemIds);
  allSettings[key] = normalized;
  await writeAllSettings(allSettings);
  return normalized;
}

module.exports = {
  getVendorSettings,
  saveVendorSettings,
  normalizeSettings,
  applySettingsToMenu,
};
