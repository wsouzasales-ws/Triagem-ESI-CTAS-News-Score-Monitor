
/**
 * Utilitário para chamadas de API com Retry (Backoff Exponencial)
 * Essencial para lidar com o LockService do Google Sheets em acessos simultâneos.
 */

export async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = 3, 
  backoff = 1000
): Promise<any> {
  try {
    // IMPORTANTE: Nunca usar 'no-cors' se quisermos garantir que salvou
    // Usamos text/plain para evitar Preflight OPTIONS que o GAS não gosta
    const finalOptions = {
        ...options,
        mode: 'cors' as RequestMode, 
    };

    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    // Se o script retornar erro de "LockTimeout" ou erro genérico, lançamos erro para o catch pegar e tentar de novo
    if (data.result === 'error') {
       // Se for erro de validação (ex: email duplicado), não tenta de novo
       if (data.message && (data.message.includes('inválido') || data.message.includes('cadastrado') || data.message.includes('encontrado') || data.message.includes('incorreta'))) {
           return data; // Retorna o erro para a UI tratar
       }
       throw new Error(data.message || 'Erro no Script Google');
    }

    return data;

  } catch (error) {
    if (retries > 0) {
      console.warn(`Tentativa falhou. Retentando em ${backoff}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    // Esgotou tentativas
    throw error;
  }
}
