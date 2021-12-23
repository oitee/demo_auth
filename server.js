import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const clientID = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const port = process.env.PORT;


const app = express();
app.use(cookieParser());

app.get("/", async (request, response) => {
  if (request.cookies["access"]) {
    const token = JSON.parse(request.cookies.access);
    const image = await getImage(token.access_token);
    return response.send(`Welcome!<br>${image}`);
  }
  return response.send(`
    <a href=${authUrl()}> Log in with Google</a>
    `);
});

app.get("/callBack", async (request, response) => {
  const accessCode = request.query.code;
  const tokens = await accessTokens(accessCode);
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

app.listen(port);



function authUrl() {
 
  const redirectID = `http://localhost:4000/callBack`; // host name to be extracted from Heroku & add URI at google API
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

  const grant = "authorization_code";
  const redirect_uri = "http://localhost:4000/callBack"; //Redirect URL: change

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

async function getImage(accessToken) {
  const scope = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json`;
  const res = await fetch(scope, {
    method: "get",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((res) => res.json());
  return `<img src="${res.picture}">`;
}
