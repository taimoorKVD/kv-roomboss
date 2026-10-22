/**
 * Normalize RoomBoss API payloads into flat listing records + detail payloads.
 */

const ARRAY_KEYS = [
  "hotels",
  "availableHotels",
  "bookings",
  "booking",
  "roomTypes",
  "availableRoomTypes",
  "ratePlans",
  "ratePlanDescriptionList",
  "ratePlanDescriptions",
  "ratePlanDescription",
  "stays",
  "availableRooms",
  "availability",
  "items",
  "results",
  "data",
];

const ID_KEYS = [
  "hotelId",
  "bookingId",
  "ratePlanId",
  "roomTypeId",
  "id",
  "customId",
];

const TITLE_KEYS = [
  "hotelName",
  "name",
  "roomTypeName",
  "ratePlanName",
  "guestFamilyName",
  "status",
  "bookingId",
  "hotelId",
];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function findRecordsArray(data) {
  if (Array.isArray(data)) return data;
  if (!isPlainObject(data)) return null;

  for (const key of ARRAY_KEYS) {
    if (Array.isArray(data[key]) && data[key].length) {
      return data[key];
    }
  }

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val) && val.length && isPlainObject(val[0])) {
      return val;
    }
  }

  return null;
}

function pickId(item, index) {
  const parts = [];
  for (const key of ID_KEYS) {
    if (item[key] != null && String(item[key]).trim() !== "") {
      parts.push(String(item[key]));
    }
  }
  if (parts.length) return parts.join("--");
  return `row-${index}`;
}

function pickTitle(item, fallbackId) {
  for (const key of TITLE_KEYS) {
    if (item[key] != null && String(item[key]).trim() !== "") {
      return String(item[key]);
    }
  }
  return fallbackId;
}

function summarizeValue(value) {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    return value.trim() === "" ? "—" : value;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    if (value.every((v) => v == null || typeof v !== "object")) {
      return value.slice(0, 4).join(", ") + (value.length > 4 ? "…" : "");
    }
    return `${value.length} item(s)`;
  }
  if (isPlainObject(value)) {
    return Object.keys(value).length ? "Object" : "—";
  }
  return String(value);
}

/**
 * Unwrap nested booking wrappers so detail pages show leadGuest/hotel/items
 * as real sections instead of a single "Object" dump.
 */
function prepareDetailForView(detail) {
  if (!isPlainObject(detail)) return detail || {};
  const source = { ...detail };
  if (!isPlainObject(source.booking)) return source;

  const booking = source.booking;
  delete source.booking;

  if (booking.leadGuest != null) source.leadGuest = booking.leadGuest;
  if (booking.hotel != null) source.hotel = booking.hotel;
  if (Array.isArray(booking.items)) source.items = booking.items;

  Object.entries(booking).forEach(([key, value]) => {
    if (key === "leadGuest" || key === "hotel" || key === "items") return;
    if (source[key] !== undefined) return;
    if (value !== null && typeof value === "object") return;
    source[key] = value;
  });

  return source;
}

function flattenForSearch(obj, prefix = "", out = {}) {
  if (obj == null) return out;
  if (Array.isArray(obj)) {
    out[prefix || "value"] = summarizeValue(obj);
    return out;
  }
  if (!isPlainObject(obj)) {
    out[prefix || "value"] = String(obj);
    return out;
  }
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value) || isPlainObject(value)) {
      out[path] = summarizeValue(value);
    } else if (value != null) {
      out[path] = String(value);
    }
  }
  return out;
}

/**
 * listAvailable nests stays under availableHotels[].availableRoomTypes[].ratePlan
 */
function flattenAvailableResponse(data) {
  if (!isPlainObject(data) || !Array.isArray(data.availableHotels)) return null;

  const checkIn = data.checkIn || "";
  const checkOut = data.checkOut || "";
  const out = [];

  data.availableHotels.forEach((hotel) => {
    if (!isPlainObject(hotel)) return;
    const rooms = Array.isArray(hotel.availableRoomTypes)
      ? hotel.availableRoomTypes
      : [];
    rooms.forEach((room) => {
      if (!isPlainObject(room)) return;
      const ratePlan = isPlainObject(room.ratePlan) ? room.ratePlan : {};
      out.push({
        hotelId: hotel.hotelId,
        hotelName: hotel.hotelName,
        currencyCode: hotel.currencyCode,
        locationCode: hotel.locationCode,
        countryCode: hotel.countryCode,
        vendorType: hotel.vendorType,
        checkIn,
        checkOut,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomTypeName,
        quantityAvailable: room.quantityAvailable,
        maxNumberGuests: room.maxNumberGuests,
        priceNumberGuests: room.priceNumberGuests,
        minNights: room.minNights,
        ratePlanId: ratePlan.ratePlanId,
        priceRetail: ratePlan.priceRetail,
        priceRetailVoucher: ratePlan.priceRetailVoucher,
        mealsIncluded: ratePlan.mealsIncluded,
        breakfast: ratePlan.breakfast,
        lunch: ratePlan.lunch,
        dinner: ratePlan.dinner,
        ratePlan,
      });
    });
  });

  return out;
}

function pickLocalized(map) {
  if (!isPlainObject(map)) return "";
  if (map.en != null && String(map.en).trim() !== "") return String(map.en);
  if (map.ja != null && String(map.ja).trim() !== "") return String(map.ja);
  const first = Object.values(map).find(
    (v) => v != null && String(v).trim() !== ""
  );
  return first != null ? String(first) : "";
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * listRatePlanDescription nests plans under [{ vendorId, ratePlanDescriptionList }]
 * with localized names/descriptions objects.
 */
function flattenRatePlanDescriptionResponse(data) {
  let vendors = null;

  if (
    Array.isArray(data) &&
    data.length &&
    isPlainObject(data[0]) &&
    Array.isArray(data[0].ratePlanDescriptionList)
  ) {
    vendors = data;
  } else if (
    isPlainObject(data) &&
    Array.isArray(data.ratePlanDescriptionList)
  ) {
    vendors = [data];
  } else if (isPlainObject(data)) {
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (
        Array.isArray(val) &&
        val.length &&
        isPlainObject(val[0]) &&
        Array.isArray(val[0].ratePlanDescriptionList)
      ) {
        vendors = val;
        break;
      }
    }
  }

  if (!vendors) return null;

  const out = [];
  vendors.forEach((vendor) => {
    if (!isPlainObject(vendor)) return;
    const hotelId = vendor.vendorId || vendor.hotelId || "";
    const list = Array.isArray(vendor.ratePlanDescriptionList)
      ? vendor.ratePlanDescriptionList
      : [];
    list.forEach((plan) => {
      if (!isPlainObject(plan)) return;
      const ratePlanName = pickLocalized(plan.names);
      const description = pickLocalized(plan.descriptions);
      const longDescription = stripHtml(pickLocalized(plan.longDescriptions));
      out.push({
        hotelId,
        vendorId: hotelId,
        ratePlanId: plan.ratePlanId,
        ratePlanName,
        description,
        longDescription,
        names: plan.names,
        descriptions: plan.descriptions,
        longDescriptions: plan.longDescriptions,
      });
    });
  });

  return out;
}

function flattenBookingEntity(booking, leadGuest) {
  if (!isPlainObject(booking)) return null;
  const item =
    Array.isArray(booking.items) && isPlainObject(booking.items[0])
      ? booking.items[0]
      : {};
  const hotel = isPlainObject(booking.hotel) ? booking.hotel : {};
  const roomType = isPlainObject(item.roomType) ? item.roomType : {};
  const lead = isPlainObject(leadGuest)
    ? leadGuest
    : isPlainObject(booking.leadGuest)
      ? booking.leadGuest
      : {};
  const guestName = [lead.givenName, lead.familyName]
    .filter((part) => part != null && String(part).trim() !== "")
    .join(" ");

  return {
    bookingId: booking.bookingId,
    customId: booking.customId,
    eId: booking.eId,
    packageId: booking.packageId,
    extent: booking.extent,
    status: booking.active === false ? "Inactive" : "Active",
    bookingType: booking.bookingType,
    bookingSource: booking.bookingSource,
    hotelId: hotel.hotelId,
    hotelName: hotel.hotelName,
    locationCode: hotel.locationCode,
    currencyCode: hotel.currencyCode,
    checkIn: item.checkIn,
    checkOut: item.checkOut,
    priceRetail: item.priceRetail,
    priceNet: item.priceNet,
    numberGuests: item.numberGuests,
    numberAdults: item.numberAdults,
    numberChildren: item.numberChildren,
    numberInfants: item.numberInfants,
    roomTypeId: roomType.roomTypeId,
    roomTypeName: roomType.roomTypeName,
    ratePlan: item.ratePlan,
    guestGivenName: lead.givenName,
    guestFamilyName: guestName || lead.familyName,
    guestEmail: lead.email,
    guestIntranetUrl: booking.guestIntranetUrl,
    booking,
  };
}

/**
 * listBookings returns { bookings: [{ booking: {...} }] }
 */
function flattenListBookingsResponse(data) {
  if (!isPlainObject(data) || !Array.isArray(data.bookings)) return null;
  if (
    data.bookings.length &&
    !isPlainObject(data.bookings[0]?.booking) &&
    data.bookings[0]?.bookingId == null
  ) {
    return null;
  }

  return data.bookings
    .map((entry) => {
      if (!isPlainObject(entry)) return null;
      if (isPlainObject(entry.booking)) {
        return flattenBookingEntity(entry.booking);
      }
      return flattenBookingEntity(entry);
    })
    .filter(Boolean);
}

/**
 * createBooking returns { order: { bookings: [...], leadGuest } }
 */
function flattenCreateBookingResponse(data) {
  if (!isPlainObject(data) || !isPlainObject(data.order)) return null;
  const bookings = Array.isArray(data.order.bookings) ? data.order.bookings : [];
  if (!bookings.length) return null;

  const lead = isPlainObject(data.order.leadGuest) ? data.order.leadGuest : {};

  return bookings
    .map((booking) => {
      const flat = flattenBookingEntity(booking, lead);
      if (!flat) return null;
      flat.order = data.order;
      return flat;
    })
    .filter(Boolean);
}

/**
 * @returns {{ records: Array, raw: any }}
 */
function normalizeResponse(data, moduleMeta = {}) {
  const columns = moduleMeta.columns || [];
  let items = flattenAvailableResponse(data);

  if (!items) {
    items = flattenRatePlanDescriptionResponse(data);
  }

  if (!items) {
    items = flattenListBookingsResponse(data);
  }

  if (!items) {
    items = flattenCreateBookingResponse(data);
  }

  if (!items) {
    items = findRecordsArray(data);
  }

  if (!items) {
    if (isPlainObject(data)) {
      items = [data];
    } else if (data != null && data !== "") {
      items = [{ value: data }];
    } else {
      items = [];
    }
  }

  const usedIds = new Set();
  const records = items.map((item, index) => {
    const source = isPlainObject(item) ? item : { value: item };
    let id = pickId(source, index);
    if (usedIds.has(id)) id = `${id}--${index}`;
    usedIds.add(id);
    const title = pickTitle(source, id);
    const flat = flattenForSearch(source);
    const searchText = Object.values(flat).join(" ").toLowerCase();

    const row = {};
    const metaKeys = moduleMeta.metaKeys || [];
    if (columns.length) {
      columns.forEach((col) => {
        row[col.key] = summarizeValue(source[col.key]);
      });
      metaKeys.forEach((key) => {
        if (row[key] !== undefined) return;
        if (source[key] == null) return;
        row[key] = summarizeValue(source[key]);
      });
    } else {
      const preferred = [
        "hotelName",
        "hotelId",
        "locationCode",
        "countryCode",
        "bookingId",
        "checkIn",
        "checkOut",
        "status",
        "roomTypeName",
        "roomTypeId",
        "ratePlanId",
        "ratePlanName",
        "guestGivenName",
        "guestFamilyName",
        "currencyCode",
        "priceRetail",
        "price",
      ];
      preferred.forEach((key) => {
        if (source[key] != null) row[key] = summarizeValue(source[key]);
      });
      Object.keys(source).forEach((key) => {
        if (row[key] !== undefined) return;
        if (typeof source[key] === "object") return;
        if (Object.keys(row).length >= 8) return;
        row[key] = summarizeValue(source[key]);
      });
    }

    const isDemo = /\bdemo\b/i.test(title) || /\bdemo\b/i.test(String(source.hotelName || ""));

    return {
      id,
      title,
      index,
      row,
      searchText,
      isDemo,
      detail: source,
    };
  });

  return { records, raw: data };
}

function isDemoRecord(record) {
  if (record?.isDemo) return true;
  const title = String(record?.title || "");
  const hotelName = String(record?.row?.hotelName || record?.detail?.hotelName || "");
  return /\bdemo\b/i.test(title) || /\bdemo\b/i.test(hotelName);
}

function filterAndPaginate(
  records,
  { q = "", page = 1, pageSize = 10, demo = "all" } = {}
) {
  const query = String(q || "").trim().toLowerCase();
  const demoFilter = ["all", "demo", "hide"].includes(String(demo))
    ? String(demo)
    : "all";

  let filtered = records;

  if (demoFilter === "demo") {
    filtered = filtered.filter((r) => isDemoRecord(r));
  } else if (demoFilter === "hide") {
    filtered = filtered.filter((r) => !isDemoRecord(r));
  }

  if (query) {
    filtered = filtered.filter((r) => r.searchText.includes(query));
  }

  const size = Math.min(Math.max(Number(pageSize) || 10, 5), 100);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (currentPage - 1) * size;
  const items = filtered.slice(start, start + size);

  return {
    items,
    pagination: {
      page: currentPage,
      pageSize: size,
      total,
      totalPages,
      from: total === 0 ? 0 : start + 1,
      to: Math.min(start + size, total),
      q: query,
      demo: demoFilter,
    },
  };
}

module.exports = {
  normalizeResponse,
  filterAndPaginate,
  summarizeValue,
  prepareDetailForView,
};
