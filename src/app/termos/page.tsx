import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCTS, formatPrice } from "@/lib/payments/products";

export const metadata: Metadata = {
  title: "Termos e Privacidade · NDCity",
  description: "Regras de uso, pagamentos, reembolso e o que o NDCity guarda sobre você.",
};

/**
 * Termos de uso e política de privacidade, em linguagem simples.
 * Não substitui orientação jurídica: revise com um advogado se o site crescer.
 */
export default function TermsPage() {
  const p = PRODUCTS;
  return (
    <main className="admin legal">
      <div className="admin-head">
        <h1>📜 Termos e Privacidade</h1>
        <Link className="btn" href="/">← Voltar ao mapa</Link>
      </div>

      <section className="card">
        <h2>O que é o NDCity</h2>
        <p>
          O NDCity é um mapa do Brasil em pixel art onde cada pessoa cria uma conta e ganha uma casinha numa cidade. É uma diversão:
          casas, prefeituras, cargos e votações não têm nenhum valor fora do site.
        </p>
      </section>

      <section className="card">
        <h2>Regras de uso</h2>
        <ul>
          <li>Uma conta e uma casinha por pessoa.</li>
          <li>
            Não use nomes de usuário ou mensagens ofensivos, discriminatórios, com assédio, golpes ou conteúdo ilegal. Também não finja ser
            outra pessoa.
          </li>
          <li>
            A equipe pode apagar mensagens, remover casas e encerrar contas que quebrem essas regras, sem reembolso de recursos já usados.
          </li>
          <li>O chat tem filtro automático, mas cada pessoa é responsável pelo que escreve.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Recursos pagos</h2>
        <ul>
          <li>
            <b>Chat da cidade</b>: {formatPrice(p.chat_mensal.priceCents)} por mês. Dá para <b>assinar no cartão</b> (renova sozinho todo mês
            até você cancelar) ou pagar <b>só 30 dias</b> (Pix ou cartão), sem renovar.
          </li>
          <li>
            <b>{p.personalizar.label}</b>: {formatPrice(p.personalizar.priceCents)} cada, vale 1 pintura (cores, modelo e bandeira) da sua
            casa ou 1 proposta de pintura da prefeitura.
          </li>
          <li>
            <b>{p.mudanca.label}</b>: {formatPrice(p.mudanca.priceCents)} cada, vale 1 mudança de cidade.
          </li>
        </ul>
        <p>
          O pagamento é feito pelo <b>Mercado Pago</b> (Pix ou cartão). As compras avulsas são cobradas uma vez só. A <b>assinatura do chat</b>{" "}
          cobra {formatPrice(p.chat_mensal.priceCents)} todo mês no cartão até você cancelar, pelo menu do site, a qualquer momento: ao cancelar,
          não há mais cobranças e o chat continua até o fim do mês já pago. O NDCity não vê nem guarda dados do seu cartão ou do seu banco.
        </p>
      </section>

      <section className="card">
        <h2>Reembolso</h2>
        <p>
          Você pode pedir reembolso em até <b>7 dias</b> depois da compra, como prevê o Código de Defesa do Consumidor, falando com a equipe
          do NDCity. Quando o pagamento é devolvido (ou contestado no banco/cartão), o recurso comprado é retirado da conta: os dias de chat
          ou a pintura/mudança que ainda não foi usada.
        </p>
      </section>

      <section className="card">
        <h2>Privacidade: o que guardamos</h2>
        <ul>
          <li>
            <b>Sua conta</b>: o nome de usuário que você escolheu e a sua senha <b>embaralhada</b> (ninguém da equipe consegue ver a senha).
          </li>
          <li>
            <b>Sua casinha</b>: cidade, lote, tipo de construção, cores, bandeira e as mensagens que você escreveu no chat.
          </li>
          <li>
            <b>Compras</b>: o que foi comprado, o valor e o número do pagamento no Mercado Pago. Na assinatura, também o e-mail da sua conta
            do Mercado Pago (exigido por ele). Dados de cartão e banco ficam só com o Mercado Pago.
          </li>
          <li>
            <b>Acessos</b>: um contador anônimo (um cookie com um número aleatório) para saber quantas pessoas visitam o site e quem está
            online. Não guardamos seu IP.
          </li>
          <li>
            <b>Cookies</b>: um cookie de login, para você não precisar entrar toda vez, e o contador acima. Não usamos cookies de anúncios.
          </li>
        </ul>
        <p>
          Seus dados não são vendidos nem compartilhados, exceto com os serviços que fazem o site funcionar (hospedagem, banco de dados e o
          Mercado Pago nos pagamentos). Você pode pedir a qualquer momento para ver ou <b>apagar sua conta e seus dados</b>, falando com a
          equipe do NDCity.
        </p>
      </section>

      <p className="muted">Última atualização: novembro de 2026.</p>
    </main>
  );
}
