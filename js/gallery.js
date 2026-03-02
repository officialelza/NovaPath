/* ============================================
   NovaPath — Gallery Page Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    renderGallery();
    initLightbox();
});

function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    const emptyState = document.getElementById('gallery-empty');
    if (!grid) return;

    if (GALLERY_IMAGES.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    grid.style.display = 'block';

    grid.innerHTML = GALLERY_IMAGES.map((img, i) => `
    <div class="gallery-item" data-index="${i}">
      <img src="data/gallery/${img.file}" alt="${img.caption || img.file}" loading="lazy">
      <div class="overlay">
        <span>${img.caption || img.file}</span>
      </div>
    </div>
  `).join('');
}

function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    const lightboxImg = lightbox.querySelector('img');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-nav.prev');
    const nextBtn = lightbox.querySelector('.lightbox-nav.next');
    let currentIndex = 0;

    document.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item');
        if (item) {
            currentIndex = parseInt(item.dataset.index);
            showLightbox(currentIndex);
        }
    });

    function showLightbox(index) {
        if (GALLERY_IMAGES.length === 0) return;
        currentIndex = index;
        const img = GALLERY_IMAGES[index];
        lightboxImg.src = `data/gallery/${img.file}`;
        lightboxImg.alt = img.caption || img.file;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', hideLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) hideLightbox();
    });

    if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
        showLightbox(currentIndex);
    });

    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % GALLERY_IMAGES.length;
        showLightbox(currentIndex);
    });

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') hideLightbox();
        if (e.key === 'ArrowLeft' && prevBtn) prevBtn.click();
        if (e.key === 'ArrowRight' && nextBtn) nextBtn.click();
    });
}
