import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx)

    return initialProps
  }
  
  render() {
    const { hostname, port, protocol } = (typeof window !== 'undefined')
      ? window.location : { hostname: 'localhost', port: 3000, protocol: 'http:' }
    const portString = (port) ? `:${port}` : ''
    const siteURL = (typeof window !== 'undefined')
      ? `${protocol}//${hostname}${portString}` : 'https://beta.fiatdao.com';
    const title = 'FIAT I'
    const description = 'Leverage and secondary liquidity for your DeFi fixed income assets'
    const twitterHandle = '@fiatdao'

    
    return (
      <Html>
        <Head>
          <meta content="summary_large_image" name="twitter:card" />
          <meta content="website" property="og:type" />
          <meta content={`${siteURL}/shareable/ogImage.jpg`} property="og:image" />
          <meta content={description} name="description" />
          <meta content={description} property="og:description" />
          <meta content={siteURL} property="og:url" />
          <meta content={title} name="twitter:site" />
          <meta content={title} property="og:title" />
          <meta content={twitterHandle} name="twitter:creator" />
          <link href="/favicon/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
          <link href="/favicon/favicon-16x16.png" rel="icon" sizes="16x16" type="image/png" />
          <link href="/favicon/favicon-32x32.png" rel="icon" sizes="32x32" type="image/png" />
          <link href="/favicon/site.webmanifest" rel="manifest" />
          <link color="#5bbad5" href="/favicon/safari-pinned-tab.svg" rel="mask-icon" />
          <meta content="#da532c" name="msapplication-TileColor" />
          <meta content="#ffffff" name="theme-color" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
