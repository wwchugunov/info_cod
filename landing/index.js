document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('connectModal');
  const openers = document.querySelectorAll('[data-open-modal]');
  const closers = document.querySelectorAll('[data-close-modal]');

  const showModal = () => {
    modal.style.display = 'flex';
  };

  const hideModal = () => {
    modal.style.display = 'none';
  };

  openers.forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    showModal();
  }));

  closers.forEach(btn => btn.addEventListener('click', hideModal));

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      hideModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.style.display === 'flex') {
      hideModal();
    }
  });
});
