# Changelog

## 0.1.0 (2026-09-05)


### Features

* **app:** add @acme/app with an acme cli and the deploy-tree prune ([41dcdeb](https://github.com/dermoumi/acme/commit/41dcdebb3ce9dc4527ca24260a19043fffa155a6))
* **app:** own the server entry and its lifecycle ([#134](https://github.com/dermoumi/acme/issues/134)) ([10eb60a](https://github.com/dermoumi/acme/commit/10eb60a0e0d72a4042448f4304c0655f1b9ab43d))
* **app:** serve the app's config as virtual:acme-config ([#142](https://github.com/dermoumi/acme/issues/142)) ([01a0cd1](https://github.com/dermoumi/acme/commit/01a0cd1cc218b41754a1ba347d4e5055989abab3))
* **assets:** serve static files from a kit ([#157](https://github.com/dermoumi/acme/issues/157)) ([87ce7d8](https://github.com/dermoumi/acme/commit/87ce7d85667ba1330c4e0948ec2d03729db489da))
* **db:** add @acme/db with dialect resolution and migrations ([4064ea0](https://github.com/dermoumi/acme/commit/4064ea0a279bc639cfcf77fa98959a3e68c761bd))
* **db:** make @acme/db a kit and mount its commands through acme ([80ddbd7](https://github.com/dermoumi/acme/commit/80ddbd7fba61d0ede199efa8ded61f669311270e))
* **deploy:** move prune out of @acme/app into its own package ([#139](https://github.com/dermoumi/acme/issues/139)) ([aceb62e](https://github.com/dermoumi/acme/commit/aceb62e1173cde4f578393d1733ca37caaee9571))
* **health:** serve /health from a kit other kits contribute to ([5f309bd](https://github.com/dermoumi/acme/commit/5f309bdab67d34dd38cb807582d12901f98ca505))
* **posy:** add app shell with routing, pwa, and screen scaffolds ([#15](https://github.com/dermoumi/acme/issues/15)) ([e125b78](https://github.com/dermoumi/acme/commit/e125b780920ea62bd189aca9864e3664da853756))
* **posy:** add kysely database foundation and initial schema ([#14](https://github.com/dermoumi/acme/issues/14)) ([01eae6c](https://github.com/dermoumi/acme/commit/01eae6c267d3a9e99c7479568f9c72e39b590071))
* **posy:** add password auth with device sessions ([#17](https://github.com/dermoumi/acme/issues/17)) ([9299c5b](https://github.com/dermoumi/acme/commit/9299c5bf9de9ccb942fe6846a6ed8d39146953e3))
* **posy:** add wrangler environments for staging and production ([20130ce](https://github.com/dermoumi/acme/commit/20130ce97727f47cf379ad41bf27a39ea5167f17))
* **posy:** build and health-check a docker image in ci ([2d7401b](https://github.com/dermoumi/acme/commit/2d7401bd82292b13191d5276c75a4b30ecbe4429))
* **posy:** gate staging and preview deployments behind basic auth ([#16](https://github.com/dermoumi/acme/issues/16)) ([a51bd5c](https://github.com/dermoumi/acme/commit/a51bd5cceb92ff52fc0d25d8b525077c18e1503f))
* **posy:** provision d1 databases with migrations on deploy ([#21](https://github.com/dermoumi/acme/issues/21)) ([e1e47c0](https://github.com/dermoumi/acme/commit/e1e47c080ed56150d8fa14fc098db1ce9673040d))
* **posy:** rate-limit login and the sentry tunnel ([#38](https://github.com/dermoumi/acme/issues/38)) ([5d96b79](https://github.com/dermoumi/acme/commit/5d96b79294d14f329de17b749ded5df114f3ac6d))
* **posy:** rename production worker to play ([3a3be02](https://github.com/dermoumi/acme/commit/3a3be0231730635157406c6be0c6c9ac0b7c7e61))
* **posy:** scaffold React + Hono app on cloudflare vite plugin ([710b986](https://github.com/dermoumi/acme/commit/710b9863d95e782e2e93db08fb728547aae15209))
* **sentry:** add @acme/sentry with error capture for server and client ([#29](https://github.com/dermoumi/acme/issues/29)) ([819ecf1](https://github.com/dermoumi/acme/commit/819ecf14488261d7fba684297e641c3aa5fc0c5f))
* **sentry:** wire error reporting through a kit ([#164](https://github.com/dermoumi/acme/issues/164)) ([6e02e40](https://github.com/dermoumi/acme/commit/6e02e40581e102a782784f9ed8086f6b0a51ae3e))


### Bug Fixes

* **posy:** serve health endpoint at /health instead of /api/health ([e557abc](https://github.com/dermoumi/acme/commit/e557abc9b4cb88080c940d2e955ae2cc5962df19))


### Refactoring

* **app:** make a kit inert until init, and identify it by specifier ([#144](https://github.com/dermoumi/acme/issues/144)) ([318164a](https://github.com/dermoumi/acme/commit/318164a889052a5a37e7b7ce1dc9591d2bcd884a))
* **ci:** split docker publish into its own reusable workflow ([#140](https://github.com/dermoumi/acme/issues/140)) ([c60d66d](https://github.com/dermoumi/acme/commit/c60d66d6675347267c1348a31440e31ce4414b1c))
* merge the files that never earned their own ([#172](https://github.com/dermoumi/acme/issues/172)) ([e46dd22](https://github.com/dermoumi/acme/commit/e46dd22b18c19be917ccc20d529f35066ed3cf2a))
* **rate-limiter:** extract @acme/rate-limiter with a curried api ([#40](https://github.com/dermoumi/acme/issues/40)) ([b9af9b1](https://github.com/dermoumi/acme/commit/b9af9b155672784642c3d166bb77880da2503e2f))


### Tests

* **posy:** run the same worker tests on node and workerd ([#22](https://github.com/dermoumi/acme/issues/22)) ([28eacab](https://github.com/dermoumi/acme/commit/28eacab998261591b2307219e3252d9227841cef))
* **posy:** stop re-testing the rate limiter through posy's routes ([b4efa66](https://github.com/dermoumi/acme/commit/b4efa666030c941f1c1baa0eb9484ea9d8c2fa16))
* put every case in a describe() and let oxlint enforce it ([a061822](https://github.com/dermoumi/acme/commit/a061822529a6b5490d8516cb14efcc1fcbf77d38))


### CI/CD

* report coverage to codecov ([da4706b](https://github.com/dermoumi/acme/commit/da4706b40a35ba8221228b37264debf868c12a81))


### Miscellaneous

* **deps:** update node.js to v24.20.0 ([#186](https://github.com/dermoumi/acme/issues/186)) ([62ef25e](https://github.com/dermoumi/acme/commit/62ef25ec0a1dcf7f533f7e4ad630cbad1e2c3200))
