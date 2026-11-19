# Orders API

This design decides how the shop's apps read and place orders. The app team and the backend team read it.

## Purpose and scope

The Orders API lets the web shop and the mobile app list a customer's orders and place new ones.
Payments and shipping stay in their own services and are out of scope.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | /orders | Lists the signed-in customer's orders, newest first |
| POST | /orders | Places an order from the customer's cart |

## Errors

The API returns 401 when the session has expired, and the app asks the customer to sign in again.
It returns 409 when the cart changed while the order was placed, and the app reloads the cart.

## Decisions

| Option | Chosen | Why |
|---|---|---|
| REST with JSON | Yes | Both apps already call REST services |
| GraphQL | No | One more server to run for two endpoints |

## Open decisions

None.
