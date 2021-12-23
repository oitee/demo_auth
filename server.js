import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
app.use(cookieParser());

app.get("/", async (request, response) => {
  if (request.cookies["access"]) {
    const token = JSON.parse(request.cookies.access);
    const {image, name} = await getProfile(token.access_token);
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
    maxAge: (tokens.expires_in - 5) * 1000,
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

async function getProfile(accessToken) {
  const scope = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json`;
  const res = await fetch(scope, {
    method: "get",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((res) => res.json());
  return { image: `<img src="${res.picture}">`, name: `${res.name}` };
}

function config() {
  const clientID = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const port = process.env.PORT;
  const baseUrl = process.env.DOMAIN;
  return { clientID, client_secret, port, baseUrl };
}
