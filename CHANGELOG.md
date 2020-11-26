# Change Log

## v1

### v1.0

#### v1.0.0

_Released 26 November 2020_

This is our first public release. Endpoints in the API from the start are:

* Members API
  * `POST /members/auth`
  * `POST /members/reauth`
  * `POST /members/providers`
  * `GET /members/providers`
  * `DELETE /members/providers/{provider}`
  * `GET /members/messages`
  * `GET /members/invited`
  * `GET /members/{id}`
  * `PATCH /members/{id}`
  * `GET /members/{id}/auths`
  * `PATCH /members/{id}/deactivate`
  * `PATCH /members/{id}/reactivate`
  * `POST /invitations/send`
  * `POST /invitations/{code}`
* Pages API
  * `GET /pages`
  * `POST /pages`
  * `GET /pages/{path}`
  * `POST /pages/{path}`
  * `POST /pages/{path}/rollback/{id}`
  * `POST /pages/{path}/like`
  * `DELETE /pages/{path}/like`
  * `PATCH /pages/{path}/lock`
  * `PATCH /pages/{path}/unlock`
  * `PATCH /pages/{path}/hide`
  * `PATCH /pages/{path}/unhide`
  * `POST /autocomplete`
  * `GET /near/{lat}/{lon}/{dist}`
  * `GET /updates/{num}`
  * `GET /requested/{num}`
  * `GET /checkpath/{path}`

Underlying these endpoints, we have the following classes:

| Class | Source file |
| --- | --- |
| `FileHandler` | `/models/fileHandler.js` |
| `History` | `/models/history.js` |
| `LikesHandler` | `/models/likesHandler.js` |
| `LinkHandler` | `/models/linkHandler.js` |
| `LocationHandler` | `/models/locationHandler.js` |
| `Member` | `/models/member.js` |
| `Page` | `/models/page.js` |
| `TagHandler` | `/models/tagHandler.js` |

We also have a number of functions used for parsing our peculiar flavor of Markdown with Wikitext fusion, in `/parser`.