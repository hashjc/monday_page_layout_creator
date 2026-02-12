import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "@vibe/core/tokens";
//Explore more Monday React Components here: https://vibe.monday.com/
import { Heading, Text, Loader, Box, Flex, TextField } from "@vibe/core";

// Usage of mondaySDK example, for more information visit here: https://developer.monday.com/apps/docs/introduction-to-the-sdk/
const monday = mondaySdk();

const App = () => {
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const [context, setContext] = useState(); // Board context from monday
    const [boardId, setBoardId] = useState(null); // Current board ID
    const [columns, setColumns] = useState([]); // List of columns in current board
    const [loading, setLoading] = useState(false); // Loading state for columns
    const [hoveredColumnId, setHoveredColumnId] = useState(null); // Track hovered column for ID display
    const [childBoards, setChildBoards] = useState([]); // Boards that link to current board
    const [loadingChildBoards, setLoadingChildBoards] = useState(false); // Loading state for child boards
    const [hoveredChildBoardId, setHoveredChildBoardId] = useState(null); // Track hovered child board
    const [selectedSection, setSelectedSection] = useState("columns"); // Track which sidebar section is active
    const [searchColumnsQuery, setSearchColumnsQuery] = useState(""); // Search query for columns
    const [searchChildBoardsQuery, setSearchChildBoardsQuery] = useState(""); // Search query for child boards

    // ============================================
    // FETCH CHILD BOARDS FUNCTION
    // ============================================
    // Queries all boards in workspace and finds boards with connected board columns
    // that link back to the current board. Returns results as "BoardName - ColumnLabel"
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

    // ============================================
    // INITIALIZE APP - FETCH BOARD DATA
    // ============================================
    // Executes on component mount. Listens for board context from monday,
    // then fetches columns and child boards for the current board.
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

    // ============================================
    // HELPER FUNCTIONS - FILTERING
    // ============================================
    // Filter columns based on search query (searches title and type)
    const filteredColumns = columns.filter(
        (column) =>
            column.title.toLowerCase().includes(searchColumnsQuery.toLowerCase()) || column.type.toLowerCase().includes(searchColumnsQuery.toLowerCase()),
    );

    // Filter child boards based on search query (searches label)
    const filteredChildBoards = childBoards.filter((item) => item.label.toLowerCase().includes(searchChildBoardsQuery.toLowerCase()));

    return (
        <Box className="App" backgroundColor="var(--primary-background-color)">
            {/* HEADER - Display board info and user */}
            <Box marginBottom="large" padding="medium">
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

            {/* MAIN LAYOUT - Sidebar + Content Area */}
            <Flex className="metadata-layout">
                {/* LEFT SIDEBAR - Navigation */}
                <Box className="sidebar">
                    {/* Columns Navigation Item */}
                    <div
                        className={`nav-item ${selectedSection === "columns" ? "active" : ""}`}
                        onClick={() => setSelectedSection("columns")}
                        style={{ cursor: "pointer" }}
                    >
                        <Text type="paragraph" weight="bold">
                            Board Columns
                        </Text>
                    </div>

                    {/* Child Boards Navigation Item */}
                    <div
                        className={`nav-item ${selectedSection === "childBoards" ? "active" : ""}`}
                        onClick={() => setSelectedSection("childBoards")}
                        style={{ cursor: "pointer" }}
                    >
                        <Text type="paragraph" weight="bold">
                            Child Boards
                        </Text>
                    </div>
                </Box>

                {/* RIGHT CONTENT AREA - Metadata Section */}
                <Box className="main-content metadata-section">
                    {/* COLUMNS VIEW */}
                    {selectedSection === "columns" && (
                        <Box>
                            <Heading type="h2" weight="bold" marginBottom="medium">
                                Board Columns
                            </Heading>

                            {/* Search input for columns */}
                            {columns && columns.length > 0 && (
                                <Box marginBottom="medium">
                                    <TextField
                                        placeholder="Search columns by name or type..."
                                        value={searchColumnsQuery}
                                        onChange={(value) => setSearchColumnsQuery(value)}
                                        onClear={() => setSearchColumnsQuery("")}
                                    />
                                </Box>
                            )}

                            {/* Loading state while fetching columns */}
                            {loading ? (
                                <Flex align="center" gap="small">
                                    <Loader />
                                    <Text type="paragraph" color="var(--primary-text-color)">
                                        Loading columns...
                                    </Text>
                                </Flex>
                            ) : columns && columns.length > 0 ? (
                                // Display columns in grid layout - hover to see column ID
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
                    )}

                    {/* CHILD BOARDS VIEW */}
                    {selectedSection === "childBoards" && (
                        <Box>
                            <Heading type="h2" weight="bold" marginBottom="medium">
                                Child Boards
                            </Heading>

                            {/* Search input for child boards */}
                            {childBoards && childBoards.length > 0 && (
                                <Box marginBottom="medium">
                                    <TextField
                                        placeholder="Search child boards by label..."
                                        value={searchChildBoardsQuery}
                                        onChange={(value) => setSearchChildBoardsQuery(value)}
                                        onClear={() => setSearchChildBoardsQuery("")}
                                    />
                                </Box>
                            )}

                            {/* Loading state while fetching child boards */}
                            {loadingChildBoards ? (
                                <Flex align="center" gap="small">
                                    <Loader />
                                    <Text type="paragraph" color="var(--primary-text-color)">
                                        Loading child boards...
                                    </Text>
                                </Flex>
                            ) : childBoards && childBoards.length > 0 ? (
                                // Display child boards in grid layout - hover to see board ID
                                // Format: "BoardName - ColumnLabel"
                                <Box className="columns-container">
                                    {filteredChildBoards.length > 0 ? (
                                        filteredChildBoards.map((item) => (
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
                                        ))
                                    ) : (
                                        <Text type="paragraph" color="var(--secondary-text-color)">
                                            No child boards match your search.
                                        </Text>
                                    )}
                                </Box>
                            ) : (
                                <Text type="paragraph" color="var(--secondary-text-color)">
                                    No child boards found.
                                </Text>
                            )}
                        </Box>
                    )}
                </Box>
            </Flex>
        </Box>
    );
};

export default App;
