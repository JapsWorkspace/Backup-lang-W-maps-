import api, { postMultipart, uploadSingleFile } from "./api";

export async function getDonations(params = {}) {
  const response = await api.get("/api/donations", { params });
  return Array.isArray(response.data) ? response.data : [];
}

export async function getMyDonations(userId, params = {}) {
  if (!userId) return [];
  const response = await api.get(`/api/donations/my-donations/${userId}`, {
    params,
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function submitDonation(payload, photo = null) {
  if (photo?.uri) {
    const response = await uploadSingleFile("/api/donations", photo.uri, {
      fieldName: "photos",
      mimeType: photo.type || "image/jpeg",
      parameters: Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [
          key,
          value == null ? "" : String(value),
        ])
      ),
    });
    return response.data;
  }

  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value == null ? "" : String(value));
  });

  const response = await postMultipart("/api/donations", formData);
  return response.data;
}
