// Apply the saved scheme before loading styles, avoiding a flash on refresh.
try {
  document.documentElement.dataset.theme = localStorage.getItem('nexbuild-theme') === 'light' ? 'light' : 'dark'
} catch {
  document.documentElement.dataset.theme = 'dark'
}
document.documentElement.style.colorScheme = document.documentElement.dataset.theme
