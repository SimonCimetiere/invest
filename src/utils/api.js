export function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token')
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.reload()
    }
    return res
  })
}
