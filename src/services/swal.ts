import Swal, { SweetAlertResult } from 'sweetalert2';

export const alertService = {
  // Success dialog
  success(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonColor: '#0f172a',
      confirmButtonText: 'ຕົກລົງ (OK)',
    });
  },

  // Error dialog
  error(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'ປິດ (Close)',
    });
  },

  // Warning dialog
  warning(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonColor: '#d97706',
      confirmButtonText: 'ຮັບຊາບ (OK)',
    });
  },

  // Confirmation dialog with custom action
  confirm(
    title: string,
    text: string,
    confirmText = 'ຢືນຢັນ (Confirm)',
    cancelText = 'ຍົກເລີກ (Cancel)',
    isDestructive = false
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      icon: isDestructive ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: isDestructive ? '#dc2626' : '#0f172a',
      cancelButtonColor: '#64748b',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
    });
  },

  // Loading spinner during async actions
  loading(title: string, text = 'ກະລຸນາລໍຖ້າ...') {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  },

  close() {
    Swal.close();
  },

  // Toast notification
  toast(icon: 'success' | 'error' | 'info' | 'warning', title: string) {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
    });
    Toast.fire({
      icon,
      title,
    });
  },
};
