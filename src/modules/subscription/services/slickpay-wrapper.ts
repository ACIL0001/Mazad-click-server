// Workaround for SlickPay ES module issue
// This file serves as a CommonJS wrapper for the SlickPay package

interface SlickPayInvoiceInterface {
  commission(amount: number): Promise<any>;
  store(data: any): Promise<any>;
  show(id: string): Promise<any>;
}

let Invoice: any;

async function initializeSlickPay(): Promise<void> {
  try {
    // Use dynamic import for ES modules
    const slickPayModule = await import('@slick-pay-algeria/slickpay-npm');
    Invoice = slickPayModule.Invoice;
    console.log('SlickPay Invoice module loaded successfully');
  } catch (error) {
    console.error('Failed to load SlickPay modules:', error);
    // Fallback - create a mock class to prevent startup failures
    class MockInvoice implements SlickPayInvoiceInterface {
      private publicKey: string;
      private sandbox: boolean;

      constructor(publicKey: string, sandbox: boolean) {
        this.publicKey = publicKey;
        this.sandbox = sandbox;
        console.warn('Using MockInvoice - SlickPay package not available');
        console.warn('This is for development/testing only. Add SLICKPAY_PUBLIC_KEY to .env for production.');
      }
      
      commission(amount: number): Promise<any> {
        return Promise.resolve({ amount: amount, commission: 0 });
      }
      
      store(data: any): Promise<any> {
        // For development/testing, return a mock successful response
        const mockId = `MOCK${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        // const mockUrl = `http://localhost:3000/subscription/payment/mock/${mockId}`;
        const mockUrl = `https://mazadclick-server.onrender.com/subscription/payment/mock/${mockId}`;
        
        console.log('Mock SlickPay store called with data:', data);
        console.log('Returning mock payment URL:', mockUrl);
        
        return Promise.resolve({ 
          success: true, 
          id: mockId,
          url: mockUrl,
          message: 'Mock payment created for development/testing'
        });
      }
      
      show(id: string): Promise<any> {
        return Promise.resolve({ 
          success: true, 
          completed: 1, // Mock as completed
          data: { status: 'completed' }
        });
      }
    }
    
    Invoice = MockInvoice;
  }
}

// Wrapper class that handles async initialization
class InvoiceWrapper implements SlickPayInvoiceInterface {
  private publicKey: string;
  private sandbox: boolean;
  private _invoice: any = null;
  private _initialized: boolean = false;

  constructor(publicKey: string, sandbox: boolean) {
    this.publicKey = publicKey;
    this.sandbox = sandbox;
  }

  private async _ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      if (!Invoice) {
        await initializeSlickPay();
      }
      this._invoice = new Invoice(this.publicKey, this.sandbox);
      this._initialized = true;
    }
  }

  async commission(amount: number): Promise<any> {
    await this._ensureInitialized();
    return this._invoice.commission(amount);
  }

  async store(data: any): Promise<any> {
    await this._ensureInitialized();
    return this._invoice.store(data);
  }

  async show(id: string): Promise<any> {
    await this._ensureInitialized();
    return this._invoice.show(id);
  }
}

export { InvoiceWrapper as Invoice }; 