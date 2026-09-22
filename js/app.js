document.addEventListener('DOMContentLoaded', function () {

  // welcome back popup toast
  const toastEl = document.getElementById('status-toast');
  if (toastEl) {
    //pretty bootstap toast
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
  }

  // add form; used GrokAI to help debug
  const addForm = document.getElementById('add-form');
  if (addForm) {
    addForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('works!.');
    });
  }

  // sign in form
  const signinForm = document.getElementById('signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('works!');
    });
  }

});