import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "@vibe/core/tokens";
//Explore more Monday React Components here: https://vibe.monday.com/
import { Heading, Text, Loader, Box, Flex } from "@vibe/core";

// Usage of mondaySDK example, for more information visit here: https://developer.monday.com/apps/docs/introduction-to-the-sdk/
const monday = mondaySdk();

const App = () => {
  const [context, setContext] = useState();
  const [boardId, setBoardId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredColumnId, setHoveredColumnId] = useState(null);
  const [childBoards, setChildBoards] = useState([]);
  const [loadingChildBoards, setLoadingChildBoards] = useState(false);
  const [hoveredChildBoardId, setHoveredChildBoardId] = useState(null);

  // Function to fetch child boards
  const fetchChildBoards = async (currentBoardId) => {
      console.log("Fetching child boards");
      setLoadingChildBoards(true);
      try {
          // First, get all boards
          const boardsQuery = `
            query {
              boards(limit: 500) {
                id
                name
                columns {
                  id
                  title
                  type
                  settings_str
                }
              }
            }
          `;

          const boardsResult = await monday.api(boardsQuery);
          const allBoards = boardsResult.data?.boards || [];
          // Find boards that have connected board columns linking to the current board
          const childBoardsList = [];

          for (const board of allBoards) {
              if (board.id === currentBoardId) continue; // Skip current board
              for (const column of board.columns || []) {
                  if (column.type === "board_relation") {
                      try {
                          const settings = JSON.parse(column.settings_str || "{}");
                          // Check if this connected board column links to our current board
                          if (settings.boardIds && settings.boardIds.includes(parseInt(currentBoardId))) {
                              childBoardsList.push({
                                  id: `${board.id}-${column.id}`,
                                  boardId: board.id,
                                  boardName: board.name,
                                  columnId: column.id,
                                  columnLabel: column.title,
                                  label: `${board.name} - ${column.title}`,
                              });
                          }
                      } catch (e) {
                          console.warn("Could not parse column settings:", e);
                      }
                  }
              }
          }

          // Sort by label alphabetically
          childBoardsList.sort((a, b) => a.label.localeCompare(b.label));
          setChildBoards(childBoardsList);
      } catch (error) {
          console.error("Error fetching child boards:", error);
      } finally {
          setLoadingChildBoards(false);
      }
  };

  useEffect(() => {
      // Notice this method notifies the monday platform that user gains a first value in an app.
      // Read more about it here: https://developer.monday.com/apps/docs/mondayexecute#value-created-for-user/
      monday.execute("valueCreatedForUser");

      // Listen for context changes
      monday.listen("context", async (res) => {
          setContext(res.data);

          // Extract board ID from context
          if (res.data && res.data.boardId) {
              setBoardId(res.data.boardId);

              // Fetch columns for this board
              setLoading(true);
              try {
                  const query = `
                    query {
                      boards(ids: [${res.data.boardId}]) {
                        columns {
                          id
                          title
                          type
                        }
                      }
                    }
                  `;

                  const result = await monday.api(query);
                  console.log("Columns ", result);
                  if (result.data && result.data.boards && result.data.boards.length > 0) {
                      const unsortedColumns = result.data.boards[0].columns || [];

                      // Sort columns alphabetically by title, then by id if titles are the same
                      const sortedColumns = [...unsortedColumns].sort((a, b) => {
                          if (a.title.toLowerCase() === b.title.toLowerCase()) {
                              return a.id.localeCompare(b.id);
                          }
                          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
                      });

                      setColumns(sortedColumns);

                      // Now fetch child boards (boards that reference this board via connected board columns)
                      await fetchChildBoards(res.data.boardId);
                  }
              } catch (error) {
                  console.error("Error fetching columns:", error);
              } finally {
                  setLoading(false);
              }
          }
      });
  }, []);

  return (
      <Box className="App" padding="medium" backgroundColor="var(--primary-background-color)">
          <Box marginBottom="large">
              <Heading type="h1" weight="bold" marginBottom="medium">
                  Monday Board Info
              </Heading>

              {context && (
                  <Box marginBottom="medium">
                      <Text type="paragraph" color="var(--primary-text-color)">
                          <strong>User ID:</strong> {context.user?.id || "Loading..."}
                      </Text>
                  </Box>
              )}

              {boardId && (
                  <Box marginBottom="medium">
                      <Text type="paragraph" color="var(--primary-text-color)">
                          <strong>Here is the board id:</strong> {boardId}
                      </Text>
                  </Box>
              )}
          </Box>

          <Box marginBottom="large" className="metadata-section">
              <Heading type="h2" weight="bold" marginBottom="medium">
                  Board Columns
              </Heading>

              {loading ? (
                  <Flex align="center" gap="small">
                      <Loader />
                      <Text type="paragraph" color="var(--primary-text-color)">
                          Loading columns...
                      </Text>
                  </Flex>
              ) : columns && columns.length > 0 ? (
                  <Box className="columns-container">
                      {columns.map((column) => (
                          <div
                              key={column.id}
                              onMouseEnter={() => setHoveredColumnId(column.id)}
                              onMouseLeave={() => setHoveredColumnId(null)}
                              className="column-card"
                          >
                              <Box
                                  padding="small"
                                  backgroundColor="var(--secondary-background-color)"
                                  border="1px solid var(--ui-border-color)"
                                  borderRadius="var(--border-radius-small)"
                              >
                                  <Flex align="center" justify="space-between">
                                      <Text type="paragraph" color="var(--primary-text-color)">
                                          <strong>{column.title}</strong> <em>({column.type})</em>
                                      </Text>
                                      {hoveredColumnId === column.id && (
                                          <Text type="paragraph" color="var(--secondary-text-color)">
                                              ID: {column.id}
                                          </Text>
                                      )}
                                  </Flex>
                              </Box>
                          </div>
                      ))}
                  </Box>
              ) : (
                  <Text type="paragraph" color="var(--secondary-text-color)">
                      No columns found or board not yet loaded.
                  </Text>
              )}
          </Box>

          <Box marginBottom="large" className="metadata-section">
              <Heading type="h2" weight="bold" marginBottom="medium">
                  Child Boards
              </Heading>

              {loadingChildBoards ? (
                  <Flex align="center" gap="small">
                      <Loader />
                      <Text type="paragraph" color="var(--primary-text-color)">
                          Loading child boards...
                      </Text>
                  </Flex>
              ) : childBoards && childBoards.length > 0 ? (
                  <Box className="columns-container">
                      {childBoards.map((item) => (
                          <div
                              key={item.id}
                              onMouseEnter={() => setHoveredChildBoardId(item.id)}
                              onMouseLeave={() => setHoveredChildBoardId(null)}
                              className="column-card"
                          >
                              <Box
                                  padding="small"
                                  backgroundColor="var(--secondary-background-color)"
                                  border="1px solid var(--ui-border-color)"
                                  borderRadius="var(--border-radius-small)"
                              >
                                  <Flex align="center" justify="space-between">
                                      <Text type="paragraph" color="var(--primary-text-color)">
                                          <strong>{item.label}</strong>
                                      </Text>
                                      {hoveredChildBoardId === item.id && (
                                          <Text type="paragraph" color="var(--secondary-text-color)">
                                              Board: {item.boardId}
                                          </Text>
                                      )}
                                  </Flex>
                              </Box>
                          </div>
                      ))}
                  </Box>
              ) : (
                  <Text type="paragraph" color="var(--secondary-text-color)">
                      No child boards found.
                  </Text>
              )}
          </Box>
      </Box>
  );
};

export default App;
