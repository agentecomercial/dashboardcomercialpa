/* =========================================================================
   components/45-notificacoes.js — Central de notificacoes.
   As notificacoes sao DERIVADAS dos dados (alertas do coordenador);
   o que persiste e apenas o estado de "lida" / "silenciada".
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db, A = App.analise;

  const CHAVE_LIDAS = 'notificacoes:lidas';

  function lidas() { return db.config.get(CHAVE_LIDAS, {}) || {}; }

  /** Lista de notificacoes ativas com marcacao de leitura. */
  function lista() {
    const l = lidas();
    return A.alertas().map(a => Object.assign({}, a, { lida: !!l[a.id] }));
  }

  function naoLidas() { return lista().filter(n => !n.lida).length; }

  function marcarLida(id) {
    const l = Object.assign({}, lidas());
    l[id] = u.nowISO();
    return db.config.set(CHAVE_LIDAS, l).then(() => App.bus.emit('notificacoes:mudou'));
  }

  function marcarTodas() {
    const l = Object.assign({}, lidas());
    lista().forEach(n => { l[n.id] = u.nowISO(); });
    return db.config.set(CHAVE_LIDAS, l).then(() => {
      App.bus.emit('notificacoes:mudou');
      App.toast.ok('Tudo lido', 'Nenhuma notificação pendente.');
    });
  }

  function abrir() {
    const corpo = u.el('div');
    let dr = null;

    function pintar() {
      u.clear(corpo);
      const ns = lista();
      if (!ns.length) {
        corpo.appendChild(p.vazio({
          icone: 'checkCircle', titulo: 'Tudo em dia',
          desc: 'Nenhum One a One atrasado, nenhum plano vencido e nenhum colaborador sem acompanhamento.'
        }));
        return;
      }
      ns.forEach(n => {
        const colab = n.colaboradorId ? db.colaboradores.por(n.colaboradorId) : null;
        corpo.appendChild(u.el('button.notif' + (n.lida ? '' : '.is-unread'), {
          type: 'button',
          onclick: () => {
            marcarLida(n.id);
            if (dr) dr.fechar();
            setTimeout(() => App.router.go(n.rota.replace('#', '')), 80);
          }
        }, [
          colab ? p.avatar(colab, 'sm') : u.el('span.notif__ic.tone-' + n.tom, { html: App.icon(n.icone) }),
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.notif__t', { text: n.titulo }),
            u.el('div.notif__d', { text: n.desc }),
            u.el('div.u-row.u-gap-2.u-mt-2', {}, [
              u.el('span', { class: 'badge badge--' + (n.tom === 'neutral' ? 'outline' : n.tom), text: n.acaoLabel || 'Abrir' })
            ])
          ])
        ]));
      });
    }

    pintar();
    let off = null, off2 = null;
    dr = App.drawer({
      titulo: 'Notificações',
      desc: u.plural(naoLidas(), 'pendência não lida', 'pendências não lidas'),
      corpo,
      acaoTopo: u.el('button.btn.btn--xs.btn--ghost', {
        type: 'button', text: 'Marcar todas', onclick: () => marcarTodas().then(pintar)
      }),
      aoFechar: () => { if (off) off(); if (off2) off2(); }
    });
    off = App.bus.on('dados:mudou', pintar);
    off2 = App.bus.on('notificacoes:mudou', pintar);
    return dr;
  }

  App.notificacoes = { lista, naoLidas, abrir, marcarLida, marcarTodas };
})(window.App);
