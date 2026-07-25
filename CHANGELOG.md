# Changelog

## 0.1.0 (2026-07-25)


### Features

* **posy:** add wrangler environments for staging and production ([20130ce](https://github.com/dermoumi/acme/commit/20130ce97727f47cf379ad41bf27a39ea5167f17))
* **posy:** rename production worker to play ([3a3be02](https://github.com/dermoumi/acme/commit/3a3be0231730635157406c6be0c6c9ac0b7c7e61))
* **posy:** scaffold React + Hono app on cloudflare vite plugin ([710b986](https://github.com/dermoumi/acme/commit/710b9863d95e782e2e93db08fb728547aae15209))
* **tsconfig:** enable incremental typechecking ([87f7797](https://github.com/dermoumi/acme/commit/87f7797f2a8e2daea4a35d19c58209cfc9a1ba7a))


### Bug Fixes

* **posy:** serve health endpoint at /health instead of /api/health ([e557abc](https://github.com/dermoumi/acme/commit/e557abc9b4cb88080c940d2e955ae2cc5962df19))


### CI/CD

* add checks workflow, release-please, and renovate config ([3244be3](https://github.com/dermoumi/acme/commit/3244be3d461cf3fcb3de050a1947e18aa0e36247))
* add CODEOWNERS to activate renovate assignees ([eda934d](https://github.com/dermoumi/acme/commit/eda934d4b313ac988b0eeb06caccd151b323a0ce))
* add three-tier app deploy workflows with per-environment secrets ([05b51e9](https://github.com/dermoumi/acme/commit/05b51e94511a52cd1527cdb1db9561acfb24bfc2))
* health-check all deploy tiers and skip release-please previews ([0e4ce25](https://github.com/dermoumi/acme/commit/0e4ce2583faf30099a0f9da10db66fb9db3efdaf))
* lint and audit workflows with actionlint and zizmor ([e4aecba](https://github.com/dermoumi/acme/commit/e4aecbaf8b76ac8f5edbd62160ae1930adea381e))
* start first releases at 0.1.0 ([6dccae8](https://github.com/dermoumi/acme/commit/6dccae870b2a8491fea967815758da42f3a5f814))


### Miscellaneous

* **deps:** update actions/cache action to v6 ([#2](https://github.com/dermoumi/acme/issues/2)) ([ad55a72](https://github.com/dermoumi/acme/commit/ad55a72cb2fb349382af0edf2b9d3262db805121))
* **deps:** update actions/checkout action to v7 ([#3](https://github.com/dermoumi/acme/issues/3)) ([8992397](https://github.com/dermoumi/acme/commit/89923970fd70860e2958f194bb75ef33550f5a6e))
* **deps:** update actions/setup-node action to v7 ([#5](https://github.com/dermoumi/acme/issues/5)) ([cdcc904](https://github.com/dermoumi/acme/commit/cdcc9048a43861c8749e1eea74ec05537e7c9846))
* **deps:** update codecov/codecov-action action to v7 ([#6](https://github.com/dermoumi/acme/issues/6)) ([9563153](https://github.com/dermoumi/acme/commit/956315348ed3acc341e5e9b2c8ec90b4e9a267a6))
* **deps:** update dependency oxfmt to v0.60.0 ([#9](https://github.com/dermoumi/acme/issues/9)) ([ae70561](https://github.com/dermoumi/acme/commit/ae7056143414f9cc280898561166facd01935fbd))
* **deps:** update dependency oxlint to v1.75.0 ([#10](https://github.com/dermoumi/acme/issues/10)) ([93f168a](https://github.com/dermoumi/acme/commit/93f168ace98071cea3cf139867199300f3aa7dd0))
* **deps:** update dependency oxlint-tsgolint to v7 ([#7](https://github.com/dermoumi/acme/issues/7)) ([0a792d4](https://github.com/dermoumi/acme/commit/0a792d47b43f4230bb2025d25d59e54a67b38d71))
* **deps:** update dependency turbo to v2.10.6 ([#8](https://github.com/dermoumi/acme/issues/8)) ([a8f7bc0](https://github.com/dermoumi/acme/commit/a8f7bc0a2a7b142db547282f4846dea218b60de4))
* **deps:** update pnpm to v11.16.0 ([#11](https://github.com/dermoumi/acme/issues/11)) ([58e2cb0](https://github.com/dermoumi/acme/commit/58e2cb0a7a35f38fc40043ea94fb0caf71b925f5))
* **devcontainer:** reap zombies and forward signals via init process ([904d3e2](https://github.com/dermoumi/acme/commit/904d3e204fd72b2c8b3a5f493962b714fee925d2))
* **devcontainer:** remove stale node user home on userdel ([ebba0d3](https://github.com/dermoumi/acme/commit/ebba0d3273e55e84bafea7ab70c82e31bc58d070))
* exclude generated changelogs from format checking ([92cc561](https://github.com/dermoumi/acme/commit/92cc5613916f0b2041d8fa08dc7c6b270f87f5fa))
* scaffold pnpm/turbo workspace with oxc tooling and devcontainer ([6bc775c](https://github.com/dermoumi/acme/commit/6bc775cbf3d6ce90bebb900b0385db1e20335376))
