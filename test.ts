import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import * as mf from "./mod.ts";

Deno.test({
  name: "install() replaces fetch, uninstall() resets it",
  fn() {
    const fetchPreInstall = globalThis.fetch;

    mf.install();
    const fetchPostInstall = globalThis.fetch;

    assertEquals(fetchPostInstall, mf.mockedFetch);
    assertNotEquals(fetchPreInstall, fetchPostInstall);

    mf.uninstall();
    const fetchPostUninstall = globalThis.fetch;

    assertEquals(fetchPreInstall, fetchPostUninstall);
  },
});

Deno.test({
  name: "fetch fails when the fetched route isn't mocked",
  async fn() {
    mf.install();
    await assertRejects(async () => {
      await fetch("https://localhost:8181/");
    });
    mf.uninstall();
  },
});

Deno.test({
  name: "fetch returns the reponse object when route matches",
  async fn() {
    mf.install();

    const routeResponse = new Response("Hello, world!", {
      status: 203,
    });

    mf.mock("/hello", () => routeResponse);

    const res = await fetch("https://0.0.0.0/hello");
    assertEquals(res, routeResponse);

    // Let's also make sure that other routes still fail
    await assertRejects(async () => {
      await fetch("https://0.0.0.0/sup");
    });

    mf.uninstall();
  },
});

Deno.test({
  name: "query parameters are ignored when routing",
  async fn() {
    mf.install();

    mf.mock("/", (req) => {
      const search = new URL(req.url).searchParams.get("query");
      assertEquals(search, "test");
      return new Response(search);
    });

    const res = await fetch("https://api.example.com/?query=test");
    assertEquals(await res.text(), "test");

    mf.uninstall();
  },
});

Deno.test({
  name: "handlers have access to the match object",
  async fn() {
    mf.install();

    mf.mock("DELETE@/lights/:id", (_req, match) => {
      assertEquals(match["id"], "2");
      return new Response();
    });

    await fetch("https://api.home.tld/lights/2", {
      method: "DELETE",
    });

    mf.uninstall();
  },
});

Deno.test({
  name: "reset() removes all handlers",
  async fn() {
    mf.install();

    assertRejects(async () => {
      await fetch("https://localhost/a");
    });
    assertRejects(async () => {
      await fetch("https://localhost/b");
    });

    mf.mock("/a", () => new Response());
    mf.mock("/b", () => new Response());

    await fetch("https://localhost/a");
    await fetch("https://localhost/b");

    mf.reset();

    assertRejects(async () => {
      await fetch("https://localhost/a");
    });
    assertRejects(async () => {
      await fetch("https://localhost/b");
    });

    mf.uninstall();
  },
});
Deno.test({
  name: "remove() removes one handler",
  async fn() {
    mf.install();

    assertRejects(async () => {
      await fetch("https://localhost/a");
    });
    assertRejects(async () => {
      await fetch("https://localhost/b");
    });

    mf.mock("/a", () => new Response());
    mf.mock("/b", () => new Response());

    await fetch("https://localhost/a");
    await fetch("https://localhost/b");

    mf.remove("/b");

    await fetch("https://localhost/a");

    assertRejects(async () => {
      await fetch("https://localhost/b");
    });

    mf.uninstall();
  },
});

Deno.test({
  name: "state isn't shared",
  async fn() {
    mf.install();

    const fg = { fetch, mock: mf.mock, remove: mf.remove, reset: mf.reset };
    const f1 = mf.sandbox();
    const f2 = mf.sandbox();

    fg.mock("/", () => new Response("global"));
    f1.mock("/", () => new Response("1"));
    f2.mock("/", () => new Response("2"));

    const responses = await Promise.all([
      fg.fetch("https://wow.cool/"),
      f1.fetch("https://wow.cool/"),
      f2.fetch("https://wow.cool/"),
    ]);

    const [tg, t1, t2] = await Promise.all(responses.map((res) => res.text()));

    assertEquals(tg, "global");
    assertEquals(t1, "1");
    assertEquals(t2, "2");

    mf.uninstall();
  },
});

Deno.test({
  name: "uninstall resets handlers",
  async fn() {
    mf.install();
    mf.mock("/", () => new Response());

    // don't need the response, just need to know this doesn't throw
    await fetch("https://nice.dev/");

    mf.uninstall();

    await assertRejects(async () => {
      await fetch("https://nice.dev/");
    });
  },
});
