import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
app.use(cookieParser());

app.get("/", async (request, response) => {
  if (request.cookies["access"]) {
    const cookieTokens = JSON.parse(request.cookies.access);
    const profile = await getProfile(cookieTokens);
    if(!profile){
      return response.redirect('/logout');
    }
    const { image, name, tokens } = profile;
    response.cookie("access", JSON.stringify(tokens), {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: config().httpsSupported
    });
    return response.send(`<h2> Welcome, ${name}!</h2> <br>${image}
    <br>
    <a href='/logout'>Logout</a>
    `);
  }
  return response.send(`
    <h1> <a href=${authUrl()}> Log in with Google</a></h1>
    `);
});

app.get("/callBack", async (request, response) => {
  const accessCode = request.query.code;
  const tokens = await accessTokens(accessCode);

  if (tokens.error) {
    console.error("Error in fetching tokens");
    console.error(tokens);
    return response.status(500).send("Something went wrong");
  }

  response.cookie("access", JSON.stringify(tokens), {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    secure: config().httpsSupported
  });
  return response.redirect(`/`);
});

app.all("/logout", (request, response) => {
  response.clearCookie("access");
  return response.redirect("/");
});

app.listen(config().port, () =>
  console.log(`Started listening on ${process.env.PORT}...`)
);

function authUrl() {
  const { clientID, baseUrl } = config();
  const redirectID = `${baseUrl}/callBack`;
  const response = `code`;
  const scope = `https://www.googleapis.com/auth/userinfo.profile`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.append("client_id", clientID);
  authUrl.searchParams.append("redirect_uri", redirectID);
  authUrl.searchParams.append("response_type", response);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("prompt", "consent");
  authUrl.searchParams.append("access_type", "offline");

  return authUrl.href;
}

function accessTokens(code) {
  const { clientID, client_secret, baseUrl } = config();
  const grant = "authorization_code";
  const redirect_uri = `${baseUrl}/callBack`;

  const params = new URLSearchParams();
  params.append("client_id", clientID);
  params.append("client_secret", client_secret);
  params.append("code", code);
  params.append("grant_type", grant);
  params.append("redirect_uri", redirect_uri);

  return fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    body: params,
  }).then((res) => res.json());
}

async function getProfile(tokens, retrying = false) {
  const scope = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json`;
  return fetch(scope, {
    method: "get",
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
    .then((res) => res.json())
    .then(({ picture, name }) => {
      if (picture) {
        return {
          image: `<img src="${picture}">`,
          name: `${name}`,
          tokens: tokens,
        };
      }
      return {};
    })
    .then(async (res) => {
      if (!res.image) {
        if (retrying) {
          return {};
        }
        let newTokens = await getNewAccessToken(tokens);
        return getProfile(newTokens, true);
      }
      return res;
    });
}

function config() {
  const clientID = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const port = process.env.PORT;
  const baseUrl = process.env.DOMAIN;
  const httpsSupported = process.env.HTTPS === 'true';

  return { clientID, client_secret, port, baseUrl, httpsSupported };
}

async function getNewAccessToken(tokens){
  const params = new URLSearchParams();
  const {clientID, client_secret} = config();
  params.append("client_id", clientID);
  params.append("client_secret", client_secret);
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", tokens.refresh_token)
  
  return fetch(`https://oauth2.googleapis.com/token`, {
    method: "post",
    body: params
  })
  .then(res => res.json())
  
}
