import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Se o usuário deixar o app aberto (ou reabrir do ícone no iOS), força uma
      // checagem de atualização assim que a tela volta a ficar visível — o
      // navegador sozinho pode demorar até um dia pra checar isso de novo.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    }).catch(() => {});

    // Quando uma versão nova assume o controle da página, recarrega uma única
    // vez automaticamente — assim o usuário nunca precisa excluir e
    // reinstalar o app pra ver as atualizações.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
