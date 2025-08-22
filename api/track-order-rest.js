// Alternatif query yang lebih sederhana
const simpleQuery = `
  query GetOrder($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        name
        customer {
          displayName
        }
        fulfillments(first: 5) {
          nodes {
            status
            trackingInfo {
              company
              number
            }
          }
        }
      }
    }
  }
`;
