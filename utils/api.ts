
/**
 * Utilitário para chamadas de API com Retry (Backoff Exponencial)
 * Essencial para lidar com o LockService do Google Sheets e Cold Starts.
 */

export async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = 3, 
  backoff = 2000 // Aumentado para 2s inicial (Cold Start do GAS pode levar 3-5s)
): Promise<any> {
  try {
    // Configuração otimizada para Google Apps Script
    const finalOptions: RequestInit = {
        ...options,
        mode: 'cors', // Necessário para ler a resposta
        credentials: 'omit', // Importante: Não enviar cookies para evitar problemas de auth cruzada
        redirect: 'follow', // Seguir redirects do Google (302)
    };

    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    // Tratamento de erros lógicos do Script
    if (data.result === 'error') {
       // Erros de validação não devem disparar retry
       if (data.message && (
           data.message.includes('inválido') || 
           data.message.includes('cadastrado') || 
           data.message.includes('encontrado') || 
           data.message.includes('incorreta')
       )) {
           return data; 
       }
       throw new Error(data.message || 'Erro no Script Google');
    }

    return data;

  } catch (error) {
    if (retries > 0) {
      console.warn(`Tentativa falhou [${url}]. Retentando em ${backoff}ms...`, error);
      // Aguarda o backoff
      await new Promise(resolve => setTimeout(resolve, backoff));
      // Tenta novamente com backoff dobrado
      return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
    }
    
    // Esgotou tentativas
    console.error("Falha final ao conectar com:", url, error);
    
    // Melhora a mensagem de erro para o usuário final
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
         throw new Error('Erro de Conexão (CORS/Rede). Verifique: 1. Se o Script está como "Qualquer Pessoa". 2. Se há AdBlock bloqueando. 3. Sua internet.');
    }
    throw error;
  }
}
