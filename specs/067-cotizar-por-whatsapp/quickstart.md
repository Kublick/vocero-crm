# Recorrido manual: cotizar por WhatsApp (AC9)

Por la línea de pruebas: tu propio número de WhatsApp en la allowlist del
cerebro. Manda `/reset` para empezar de cero (IA reactivada, lead a la
primera etapa; el historial queda).

## Antes

1. CRM con `TIENDA=on`. En Agente, «Consultar inventario», «Cotizar» y «Mover
   de etapa» encendidas.
2. En Pipeline (administrador de etapas), las etapas «Cotización pendiente» y «Cotización
   enviada», abiertas y en ese orden, antes de las de cierre.
3. Cerebro (fork de Nea) con `SHOPIFY_STORE_DOMAIN`,
   `SHOPIFY_STOREFRONT_TOKEN`, `CART_LINK_ORIGIN` y `STT_PROVIDER`.
4. Ten a mano un producto con existencia, uno sin existencia y uno «Precio a
   cotizar».

## 1. Por texto

1. Escribe: «¿tienen <producto con existencia>?». Esperado: dice que sí, sin
   número.
2. «Necesito 3». Esperado: confirma que alcanza.
3. «Y también <producto sin existencia>, 2». Esperado: dice que no hay o
   cuántas hay.
4. «Cotízame eso». Esperado:
   - repite la lista y espera «sí»;
   - pregunta si requiere factura;
   - dice que una persona confirma en breve;
   - **no** manda enlace.
5. En el CRM:
   - una nota «Nota interna · Agente» con el formato de la spec: la línea sin
     existencia marcada «NO va en el enlace», y el enlace solo con la que
     tiene existencia;
   - la ficha con `ultima_cotizacion` (una línea, sin enlace) y `requiere_cfdi`;
   - el lead en «Cotización pendiente»;
   - la conversación en handoff.
6. Abre el enlace de la nota. Esperado: el checkout de Shopify con la línea
   y la cantidad correctas.

## 2. Por audio

1. `/reset`.
2. Manda una nota de voz pidiendo un producto por marca y número de parte.
3. Esperado: el cerebro repite la lista en texto. Si entendió mal, corrígelo;
   al confirmar sigue igual que por texto.
4. En la nota: la línea «Pedido por audio: «…»» con la transcripción.
5. Con `STT_PROVIDER=modulate` y una llave inválida, manda otro audio.
   Esperado: «No pude escuchar tu audio, ¿me lo escribes?».

## 3. Mixto con «Precio a cotizar»

1. Pide el producto «Precio a cotizar».
2. Esperado: el cerebro no da precio y la línea va marcada `precio_a_cotizar`
   en la nota y en la ficha.

## Cierre

La persona manda el enlace desde la Bandeja, captura el monto en el trato y
lo mueve a «Cotización enviada». El agente sigue en pausa.
