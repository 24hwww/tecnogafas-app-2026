/**
 * Utility for handling communication with Kodular via window.appAPI or AppInventor
 */

export const kodular = {
  /**
   * Safe call to a method in Kodular appAPI
   * @param methodName The name of the function to call in Kodular
   * @param args Arguments to pass to the function
   */
  call: (methodName: string, ...args: any[]) => {
    if (typeof window !== 'undefined' && (window as any).appAPI && typeof (window as any).appAPI[methodName] === 'function') {
      try {
        (window as any).appAPI[methodName](...args);
      } catch (error) {
        console.error(`Error calling Kodular appAPI.${methodName}:`, error);
      }
    } else {
      console.warn(`Kodular appAPI.${methodName} is not available.`);
    }
  },

  /**
   * Set web view string for AppInventor/Kodular communication
   */
  setWebViewString: (data: any) => {
    if (typeof window !== 'undefined' && (window as any).AppInventor) {
      try {
        (window as any).AppInventor.setWebViewString(JSON.stringify(data));
      } catch (error) {
        console.error('Error setting AppInventor WebViewString:', error);
      }
    } else {
      console.warn('AppInventor is not available.');
    }
  },

  // Helper methods for specific components
  
  // Barcode/QR Scanner
  scanBarcode: () => kodular.call('ScanBarcode'),
  
  // Fingerprint
  authenticateFingerprint: () => kodular.call('AuthenticateFingerprint'),
  
  // Sharing
  shareMessage: (message: string) => kodular.call('ShareMessage', message),
  
  // Downloader
  downloadFile: (url: string, fileName: string) => kodular.call('DownloadFile', url, fileName),
  
  // Databases (Example usage: passing command to Kodular to handle)
  storeTinyDB: (tag: string, value: string) => kodular.setWebViewString({ action: 'storeTinyDB', tag, value }),
  getTinyDB: (tag: string) => kodular.setWebViewString({ action: 'getTinyDB', tag }),

  /**
   * Check if Kodular appAPI or AppInventor exists
   */
  isAvailable: () => {
    return typeof window !== 'undefined' && (!!(window as any).appAPI || !!(window as any).AppInventor);
  }
};
